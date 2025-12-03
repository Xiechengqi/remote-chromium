/*
 * noVNC: HTML5 VNC client
 * Copyright (C) 2012 Joel Martin
 * Copyright (C) 2013 Samuel Mannehed for Cendio AB
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * See README.md for usage and integration instructions.
 *
 * TIGHT decoder portion:
 * (c) 2012 Michael Tinglof, Joe Balaz, Les Piech (Mercuri.ca)
 */

/*jslint white: false, browser: true */
/*global window, Util, Display, Keyboard, Mouse, Websock, Websock_native, Base64, DES */

var RFB;

(function () {
    "use strict";
    RFB = function (defaults) {
        if (!defaults) {
            defaults = {};
        }

        this._rfb_host = '';
        this._rfb_port = 5900;
        this._rfb_password = '';
        this._rfb_path = '';

        this._rfb_state = 'disconnected';
        this._rfb_version = 0;
        this._rfb_max_version = 3.8;
        this._rfb_auth_scheme = '';

        this._rfb_tightvnc = false;
        this._rfb_xvp_ver = 0;

        // In preference order
        this._encodings = [
            ['COPYRECT',            0x01 ],
            ['TIGHT',               0x07 ],
            ['TIGHT_PNG',           -260 ],
            ['HEXTILE',             0x05 ],
            ['RRE',                 0x02 ],
            ['RAW',                 0x00 ],
            ['DesktopSize',         -223 ],
            ['Cursor',              -239 ],

            // Psuedo-encoding settings
            //['JPEG_quality_lo',    -32 ],
            ['JPEG_quality_med',     -26 ],
            //['JPEG_quality_hi',    -23 ],
            //['compress_lo',       -255 ],
            ['compress_hi',         -247 ],
            ['last_rect',           -224 ],
            ['xvp',                 -309 ],
            ['ExtendedDesktopSize', -308 ]
        ];

        this._encHandlers = {};
        this._encNames = {};
        this._encStats = {};

        this._sock = null;              // Websock object
        this._display = null;           // Display object
        this._keyboard = null;          // Keyboard input handler object
        this._mouse = null;             // Mouse input handler object
        this._sendTimer = null;         // Send Queue check timer
        this._disconnTimer = null;      // disconnection timer
        this._msgTimer = null;          // queued handle_msg timer

        // Frame buffer update state
        this._FBU = {
            rects: 0,
            subrects: 0,            // RRE
            lines: 0,               // RAW
            tiles: 0,               // HEXTILE
            bytes: 0,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            encoding: 0,
            subencoding: -1,
            background: null,
            zlib: []                // TIGHT zlib streams
        };

        this._fb_Bpp = 4;
        this._fb_depth = 3;
        this._fb_width = 0;
        this._fb_height = 0;
        this._fb_name = "";

        this._destBuff = null;
        this._paletteBuff = new Uint8Array(1024);  // 256 * 4 (max palette size * max bytes-per-pixel)

        this._rre_chunk_sz = 100;

        this._timing = {
            last_fbu: 0,
            fbu_total: 0,
            fbu_total_cnt: 0,
            full_fbu_total: 0,
            full_fbu_cnt: 0,

            fbu_rt_start: 0,
            fbu_rt_total: 0,
            fbu_rt_cnt: 0,
            pixels: 0
        };

        this._supportsSetDesktopSize = false;
        this._screen_id = 0;
        this._screen_flags = 0;

        // Mouse state
        this._mouse_buttonMask = 0;
        this._mouse_arr = [];
        this._viewportDragging = false;
        this._viewportDragPos = {};
        this._viewportHasMoved = false;

        // set the default value on user-facing properties
        Util.set_defaults(this, defaults, {
            'target': 'null',                       // VNC display rendering Canvas object
            'focusContainer': document,             // DOM element that captures keyboard input
            'encrypt': false,                       // Use TLS/SSL/wss encryption
            'true_color': true,                     // Request true color pixel data
            'local_cursor': false,                  // Request locally rendered cursor
            'shared': true,                         // Request shared mode
            'view_only': false,                     // Disable client mouse/keyboard
            'xvp_password_sep': '@',                // Separator for XVP password fields
            'disconnectTimeout': 3,                 // Time (s) to wait for disconnection
            'wsProtocols': ['binary'],              // Protocols to use in the WebSocket connection
            'repeaterID': '',                       // [UltraVNC] RepeaterID to connect to
            'viewportDrag': false,                  // Move the viewport on mouse drags
            'clipboardEncoding': 'utf-8',            // Clipboard encoding: 'auto', 'utf-8', 'latin-1', 'gbk', 'gb2312'

            // Callback functions
            'onUpdateState': function () { },       // onUpdateState(rfb, state, oldstate, statusMsg): state update/change
            'onPasswordRequired': function () { },  // onPasswordRequired(rfb): VNC password is required
            'onClipboard': function () { },         // onClipboard(rfb, text): RFB clipboard contents received
            'onBell': function () { },              // onBell(rfb): RFB Bell message received
            'onFBUReceive': function () { },        // onFBUReceive(rfb, fbu): RFB FBU received but not yet processed
            'onFBUComplete': function () { },       // onFBUComplete(rfb, fbu): RFB FBU received and processed
            'onFBResize': function () { },          // onFBResize(rfb, width, height): frame buffer resized
            'onDesktopName': function () { },       // onDesktopName(rfb, name): desktop name received
            'onXvpInit': function () { },           // onXvpInit(version): XVP extensions active for this connection
        });

        // main setup
        Util.Debug(">> RFB.constructor");

        // populate encHandlers with bound versions
        Object.keys(RFB.encodingHandlers).forEach(function (encName) {
            this._encHandlers[encName] = RFB.encodingHandlers[encName].bind(this);
        }.bind(this));

        // Create lookup tables based on encoding number
        for (var i = 0; i < this._encodings.length; i++) {
            this._encHandlers[this._encodings[i][1]] = this._encHandlers[this._encodings[i][0]];
            this._encNames[this._encodings[i][1]] = this._encodings[i][0];
            this._encStats[this._encodings[i][1]] = [0, 0];
        }

        // NB: nothing that needs explicit teardown should be done
        // before this point, since this can throw an exception
        try {
            this._display = new Display({target: this._target});
        } catch (exc) {
            Util.Error("Display exception: " + exc);
            throw exc;
        }

        this._keyboard = new Keyboard({target: this._focusContainer,
                                       onKeyPress: this._handleKeyPress.bind(this)});

        this._mouse = new Mouse({target: this._target,
                                 onMouseButton: this._handleMouseButton.bind(this),
                                 onMouseMove: this._handleMouseMove.bind(this),
                                 notify: this._keyboard.sync.bind(this._keyboard)});

        this._sock = new Websock();
        this._sock.on('message', this._handle_message.bind(this));
        this._sock.on('open', function () {
            if (this._rfb_state === 'connect') {
                this._updateState('ProtocolVersion', "Starting VNC handshake");
            } else {
                this._fail("Got unexpected WebSocket connection");
            }
        }.bind(this));
        this._sock.on('close', function (e) {
            Util.Warn("WebSocket on-close event");
            var msg = "";
            if (e.code) {
                msg = " (code: " + e.code;
                if (e.reason) {
                    msg += ", reason: " + e.reason;
                }
                msg += ")";
            }
            if (this._rfb_state === 'disconnect') {
                this._updateState('disconnected', 'VNC disconnected' + msg);
            } else if (this._rfb_state === 'ProtocolVersion') {
                this._fail('Failed to connect to server' + msg);
            } else if (this._rfb_state in {'failed': 1, 'disconnected': 1}) {
                Util.Error("Received onclose while disconnected" + msg);
            } else {
                this._fail("Server disconnected" + msg);
            }
            this._sock.off('close');
        }.bind(this));
        this._sock.on('error', function (e) {
            Util.Warn("WebSocket on-error event");
        });

        this._init_vars();

        var rmode = this._display.get_render_mode();
        if (Websock_native) {
            Util.Info("Using native WebSockets");
            this._updateState('loaded', 'noVNC ready: native WebSockets, ' + rmode);
        } else {
            this._cleanupSocket('fatal');
            throw new Error("WebSocket support is required to use noVNC");
        }

        Util.Debug("<< RFB.constructor");
    };

    RFB.prototype = {
        // Public methods
        connect: function (host, port, password, path) {
            this._rfb_host = host;
            this._rfb_port = port;
            this._rfb_password = (password !== undefined) ? password : "";
            this._rfb_path = (path !== undefined) ? path : "";

            if (!this._rfb_host || !this._rfb_port) {
                return this._fail("Must set host and port");
            }

            this._updateState('connect');
        },

        disconnect: function () {
            this._updateState('disconnect', 'Disconnecting');
            this._sock.off('error');
            this._sock.off('message');
            this._sock.off('open');
        },

        sendPassword: function (passwd) {
            this._rfb_password = passwd;
            this._rfb_state = 'Authentication';
            setTimeout(this._init_msg.bind(this), 1);
        },

        sendCtrlAltDel: function () {
            if (this._rfb_state !== 'normal' || this._view_only) { return false; }
            Util.Info("Sending Ctrl-Alt-Del");

            RFB.messages.keyEvent(this._sock, XK_Control_L, 1);
            RFB.messages.keyEvent(this._sock, XK_Alt_L, 1);
            RFB.messages.keyEvent(this._sock, XK_Delete, 1);
            RFB.messages.keyEvent(this._sock, XK_Delete, 0);
            RFB.messages.keyEvent(this._sock, XK_Alt_L, 0);
            RFB.messages.keyEvent(this._sock, XK_Control_L, 0);

            this._sock.flush();
        },

        xvpOp: function (ver, op) {
            if (this._rfb_xvp_ver < ver) { return false; }
            Util.Info("Sending XVP operation " + op + " (version " + ver + ")");
            this._sock.send_string("\xFA\x00" + String.fromCharCode(ver) + String.fromCharCode(op));
            return true;
        },

        xvpShutdown: function () {
            return this.xvpOp(1, 2);
        },

        xvpReboot: function () {
            return this.xvpOp(1, 3);
        },

        xvpReset: function () {
            return this.xvpOp(1, 4);
        },

        // Send a key press. If 'down' is not specified then send a down key
        // followed by an up key.
        sendKey: function (code, down) {
            if (this._rfb_state !== "normal" || this._view_only) { return false; }
            if (typeof down !== 'undefined') {
                Util.Info("Sending key code (" + (down ? "down" : "up") + "): " + code);
                RFB.messages.keyEvent(this._sock, code, down ? 1 : 0);
            } else {
                Util.Info("Sending key code (down + up): " + code);
                RFB.messages.keyEvent(this._sock, code, 1);
                RFB.messages.keyEvent(this._sock, code, 0);
            }

            this._sock.flush();
        },

        clipboardPasteFrom: function (text) {
            if (this._rfb_state !== 'normal') { return; }
            RFB.messages.clientCutText(this._sock, text);
            this._sock.flush();
        },

        // GBK/GB2312 解码方法
        _decodeGBK: function (bytes) {
            try {
                // 简单实现：将字节对转换为 Unicode
                // 注意：这是一个简化的实现，完整的 GBK 编码表很大
                var result = '';
                var i = 0;

                while (i < bytes.length) {
                    var b1 = bytes[i];

                    // ASCII 字符 (0x00-0x7F)
                    if (b1 < 0x80) {
                        result += String.fromCharCode(b1);
                        i++;
                    }
                    // GBK 双字节字符 (0x81-0xFE)
                    else if (b1 >= 0x81 && b1 <= 0xFE && i + 1 < bytes.length) {
                        var b2 = bytes[i + 1];

                        // 简单的 GBK 到 Unicode 映射（常见中文字符）
                        // 这里只实现部分常见字符的转换
                        var gbkCode = (b1 << 8) | b2;
                        var unicode = this._gbkToUnicode(gbkCode);

                        if (unicode) {
                            result += String.fromCharCode(unicode);
                        } else {
                            // 无法转换，使用替换字符
                            result += '�';
                        }

                        i += 2;
                    }
                    // 无效字节
                    else {
                        result += '�';
                        i++;
                    }
                }

                return result;
            } catch (e) {
                Util.Error("GBK decode error: " + e);
                return null;
            }
        },

        // 简化的 GBK 到 Unicode 映射表（部分常见字符）
        _gbkToUnicode: function (gbkCode) {
            // 这里只实现部分映射，实际需要完整的 GBK 编码表
            var map = {
                0xB0A1: 0x554A, // 啊
                0xB0A2: 0x963F, // 阿
                0xB0A3: 0x57C3, // 埃
                0xB0A4: 0x6328, // 挨
                0xB0A5: 0x54CE, // 哎
                0xB0A6: 0x5509, // 唉
                0xB0A7: 0x54C0, // 哀
                // 添加更多常见字符...
            };

            return map[gbkCode] || 0;
        },

        // 检测数据是否可能是 UTF-8 编码
        _isLikelyUTF8: function (bytes) {
            if (!bytes || bytes.length === 0) return false;

            var i = 0;
            var utf8Sequences = 0;
            var totalSequences = 0;

            while (i < bytes.length) {
                var b1 = bytes[i];

                // 单字节 ASCII (0x00-0x7F)
                if (b1 < 0x80) {
                    i++;
                    continue;
                }

                // 2字节 UTF-8 序列 (110xxxxx 10xxxxxx)
                if ((b1 & 0xE0) === 0xC0 && i + 1 < bytes.length) {
                    var b2 = bytes[i + 1];
                    if ((b2 & 0xC0) === 0x80) {
                        utf8Sequences++;
                        totalSequences++;
                        i += 2;
                        continue;
                    }
                }

                // 3字节 UTF-8 序列 (1110xxxx 10xxxxxx 10xxxxxx)
                if ((b1 & 0xF0) === 0xE0 && i + 2 < bytes.length) {
                    var b2 = bytes[i + 1];
                    var b3 = bytes[i + 2];
                    if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
                        utf8Sequences++;
                        totalSequences++;
                        i += 3;
                        continue;
                    }
                }

                // 4字节 UTF-8 序列 (11110xxx 10xxxxxx 10xxxxxx 10xxxxxx)
                if ((b1 & 0xF8) === 0xF0 && i + 3 < bytes.length) {
                    var b2 = bytes[i + 1];
                    var b3 = bytes[i + 2];
                    var b4 = bytes[i + 3];
                    if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80 && (b4 & 0xC0) === 0x80) {
                        utf8Sequences++;
                        totalSequences++;
                        i += 4;
                        continue;
                    }
                }

                // 无效的 UTF-8 序列
                if (b1 >= 0x80) {
                    totalSequences++;
                }
                i++;
            }

            // 如果有 UTF-8 序列，且有效序列比例高，则可能是 UTF-8
            if (totalSequences > 0) {
                var ratio = utf8Sequences / totalSequences;
                return ratio > 0.7; // 70% 以上的多字节序列是有效的 UTF-8
            }

            return false;
        },

        // 检测数据是否可能是 Latin-1 编码
        _isLikelyLatin1: function (bytes) {
            if (!bytes || bytes.length === 0) return false;

            // Latin-1 允许 0x80-0xFF 的字节，但某些值不常用
            var highBytes = 0;
            var suspiciousBytes = 0;

            for (var i = 0; i < bytes.length; i++) {
                var b = bytes[i];
                if (b >= 0x80) {
                    highBytes++;
                    // 检查是否可能是 UTF-8 首字节
                    if ((b & 0xE0) === 0xC0 || (b & 0xF0) === 0xE0 || (b & 0xF8) === 0xF0) {
                        suspiciousBytes++;
                    }
                }
            }

            // 如果高字节比例高，且不太可能是 UTF-8 首字节，则可能是 Latin-1
            var highByteRatio = highBytes / bytes.length;
            var suspiciousRatio = suspiciousBytes / Math.max(1, highBytes);

            return highByteRatio > 0.1 && suspiciousRatio < 0.3;
        },

        // 检查文本是否合理（不是误解码的 UTF-8）
        _isReasonableText: function (text) {
            if (!text || text.length === 0) return true;

            // 检查是否包含典型的误解码模式
            var misdecodedPatterns = [
                /ä½\s*å¥½/,  // 你好 被误解码
                /æ/,        // 我 被误解码
                /ç/,        // 的 被误解码
                /å/,        // 和 被误解码
            ];

            for (var i = 0; i < misdecodedPatterns.length; i++) {
                if (misdecodedPatterns[i].test(text)) {
                    return false;
                }
            }

            // 检查是否有太多 Latin-1 扩展字符
            var latin1Extended = 0;
            for (var i = 0; i < text.length; i++) {
                var code = text.charCodeAt(i);
                if (code >= 0x80 && code <= 0xFF) {
                    latin1Extended++;
                }
            }

            var ratio = latin1Extended / text.length;
            return ratio < 0.3; // 如果超过 30% 是 Latin-1 扩展字符，可能不合理
        },

        // 检查 Latin-1 解码结果是否可能是误解码的 UTF-8
        _isMisdecodedUTF8: function (latin1Text, bytes) {
            if (!latin1Text || latin1Text.length === 0) return false;

            // 检查是否包含典型的 UTF-8 被 Latin-1 误解码的字符
            var misdecodedChars = ['ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï'];
            var misdecodedCount = 0;

            for (var i = 0; i < latin1Text.length; i++) {
                var char = latin1Text[i];
                if (misdecodedChars.includes(char)) {
                    misdecodedCount++;
                }
            }

            // 如果有很多误解码字符，且字节看起来像 UTF-8
            var misdecodedRatio = misdecodedCount / latin1Text.length;
            var isLikelyUTF8 = this._isLikelyUTF8(bytes);

            return misdecodedRatio > 0.1 && isLikelyUTF8;
        },

        // Requests a change of remote desktop size. This message is an extension
        // and may only be sent if we have received an ExtendedDesktopSize message
        requestDesktopSize: function (width, height) {
            if (this._rfb_state !== "normal") { return; }

            if (this._supportsSetDesktopSize) {
                RFB.messages.setDesktopSize(this._sock, width, height,
                                            this._screen_id, this._screen_flags);
                this._sock.flush();
            }
        },

        requestFrameBufferUpdate: function() {
            RFB.messages.fbUpdateRequests(this._sock, this._display.getCleanDirtyReset(), this._fb_width, this._fb_height);
        },


        // Private methods

        _connect: function () {
            Util.Debug(">> RFB.connect");

            var uri;
            if (typeof UsingSocketIO !== 'undefined') {
                uri = 'http';
            } else {
                uri = this._encrypt ? 'wss' : 'ws';
            }

            uri += '://' + this._rfb_host + ':' + this._rfb_port + '/' + this._rfb_path;
            Util.Info("connecting to " + uri);

            this._sock.open(uri, this._wsProtocols);

            Util.Debug("<< RFB.connect");
        },

        _init_vars: function () {
            // reset state
            this._FBU.rects        = 0;
            this._FBU.subrects     = 0;  // RRE and HEXTILE
            this._FBU.lines        = 0;  // RAW
            this._FBU.tiles        = 0;  // HEXTILE
            this._FBU.zlibs        = []; // TIGHT zlib encoders
            this._mouse_buttonMask = 0;
            this._mouse_arr        = [];
            this._rfb_tightvnc     = false;

            // Clear the per connection encoding stats
            var i;
            for (i = 0; i < this._encodings.length; i++) {
                this._encStats[this._encodings[i][1]][0] = 0;
            }

            for (i = 0; i < 4; i++) {
                this._FBU.zlibs[i] = new inflator.Inflate();
            }
        },

        _print_stats: function () {
            Util.Info("Encoding stats for this connection:");
            var i, s;
            for (i = 0; i < this._encodings.length; i++) {
                s = this._encStats[this._encodings[i][1]];
                if (s[0] + s[1] > 0) {
                    Util.Info("    " + this._encodings[i][0] + ": " + s[0] + " rects");
                }
            }

            Util.Info("Encoding stats since page load:");
            for (i = 0; i < this._encodings.length; i++) {
                s = this._encStats[this._encodings[i][1]];
                Util.Info("    " + this._encodings[i][0] + ": " + s[1] + " rects");
            }
        },

        _cleanupSocket: function (state) {
            if (this._sendTimer) {
                clearInterval(this._sendTimer);
                this._sendTimer = null;
            }

            if (this._msgTimer) {
                clearInterval(this._msgTimer);
                this._msgTimer = null;
            }

            if (this._display && this._display.get_context()) {
                this._keyboard.ungrab();
                this._mouse.ungrab();
                if (state !== 'connect' && state !== 'loaded') {
                    this._display.defaultCursor();
                }
                if (Util.get_logging() !== 'debug' || state === 'loaded') {
                    // Show noVNC logo on load and when disconnected, unless in
                    // debug mode
                    this._display.clear();
                }
            }

            this._sock.close();
        },

        /*
         * Page states:
         *   loaded       - page load, equivalent to disconnected
         *   disconnected - idle state
         *   connect      - starting to connect (to ProtocolVersion)
         *   normal       - connected
         *   disconnect   - starting to disconnect
         *   failed       - abnormal disconnect
         *   fatal        - failed to load page, or fatal error
         *
         * RFB protocol initialization states:
         *   ProtocolVersion
         *   Security
         *   Authentication
         *   password     - waiting for password, not part of RFB
         *   SecurityResult
         *   ClientInitialization - not triggered by server message
         *   ServerInitialization (to normal)
         */
        _updateState: function (state, statusMsg) {
            var oldstate = this._rfb_state;

            if (state === oldstate) {
                // Already here, ignore
                Util.Debug("Already in state '" + state + "', ignoring");
            }

            /*
             * These are disconnected states. A previous connect may
             * asynchronously cause a connection so make sure we are closed.
             */
            if (state in {'disconnected': 1, 'loaded': 1, 'connect': 1,
                          'disconnect': 1, 'failed': 1, 'fatal': 1}) {
                this._cleanupSocket(state);
            }

            if (oldstate === 'fatal') {
                Util.Error('Fatal error, cannot continue');
            }

            var cmsg = typeof(statusMsg) !== 'undefined' ? (" Msg: " + statusMsg) : "";
            var fullmsg = "New state '" + state + "', was '" + oldstate + "'." + cmsg;
            if (state === 'failed' || state === 'fatal') {
                Util.Error(cmsg);
            } else {
                Util.Warn(cmsg);
            }

            if (oldstate === 'failed' && state === 'disconnected') {
                // do disconnect action, but stay in failed state
                this._rfb_state = 'failed';
            } else {
                this._rfb_state = state;
            }

            if (this._disconnTimer && this._rfb_state !== 'disconnect') {
                Util.Debug("Clearing disconnect timer");
                clearTimeout(this._disconnTimer);
                this._disconnTimer = null;
                this._sock.off('close');  // make sure we don't get a double event
            }

            switch (state) {
                case 'normal':
                    if (oldstate === 'disconnected' || oldstate === 'failed') {
                        Util.Error("Invalid transition from 'disconnected' or 'failed' to 'normal'");
                    }
                    break;

                case 'connect':
                    this._init_vars();
                    this._connect();
                    // WebSocket.onopen transitions to 'ProtocolVersion'
                    break;

                case 'disconnect':
                    this._disconnTimer = setTimeout(function () {
                        this._fail("Disconnect timeout");
                    }.bind(this), this._disconnectTimeout * 1000);

                    this._print_stats();

                    // WebSocket.onclose transitions to 'disconnected'
                    break;

                case 'failed':
                    if (oldstate === 'disconnected') {
                        Util.Error("Invalid transition from 'disconnected' to 'failed'");
                    } else if (oldstate === 'normal') {
                        Util.Error("Error while connected.");
                    } else if (oldstate === 'init') {
                        Util.Error("Error while initializing.");
                    }

                    // Make sure we transition to disconnected
                    setTimeout(function () {
                        this._updateState('disconnected');
                    }.bind(this), 50);

                    break;

                default:
                    // No state change action to take
            }

            if (oldstate === 'failed' && state === 'disconnected') {
                this._onUpdateState(this, state, oldstate);
            } else {
                this._onUpdateState(this, state, oldstate, statusMsg);
            }
        },

        _fail: function (msg) {
            this._updateState('failed', msg);
            return false;
        },

        _handle_message: function () {
            if (this._sock.rQlen() === 0) {
                Util.Warn("handle_message called on an empty receive queue");
                return;
            }

            switch (this._rfb_state) {
                case 'disconnected':
                case 'failed':
                    Util.Error("Got data while disconnected");
                    break;
                case 'normal':
                    if (this._normal_msg() && this._sock.rQlen() > 0) {
                        // true means we can continue processing
                        // Give other events a chance to run
                        if (this._msgTimer === null) {
                            Util.Debug("More data to process, creating timer");
                            this._msgTimer = setTimeout(function () {
                                this._msgTimer = null;
                                this._handle_message();
                            }.bind(this), 10);
                        } else {
                            Util.Debug("More data to process, existing timer");
                        }
                    }
                    break;
                default:
                    this._init_msg();
                    break;
            }
        },

        _handleKeyPress: function (keysym, down) {
            if (this._view_only) { return; } // View only, skip keyboard, events
            RFB.messages.keyEvent(this._sock, keysym, down);
            this._sock.flush();
        },

        _handleMouseButton: function (x, y, down, bmask) {
            if (down) {
                this._mouse_buttonMask |= bmask;
            } else {
                this._mouse_buttonMask ^= bmask;
            }

            if (this._viewportDrag) {
                if (down && !this._viewportDragging) {
                    this._viewportDragging = true;
                    this._viewportDragPos = {'x': x, 'y': y};

                    // Skip sending mouse events
                    return;
                } else {
                    this._viewportDragging = false;

                    // If the viewport didn't actually move, then treat as a mouse click event
                    // Send the button down event here, as the button up event is sent at the end of this function
                    if (!this._viewportHasMoved && !this._view_only) {
                        RFB.messages.pointerEvent(this._sock, this._display.absX(x), this._display.absY(y), bmask);
                    }
                    this._viewportHasMoved = false;
                }
            }

            if (this._view_only) { return; } // View only, skip mouse events

            if (this._rfb_state !== "normal") { return; }
            RFB.messages.pointerEvent(this._sock, this._display.absX(x), this._display.absY(y), this._mouse_buttonMask);
        },

        _handleMouseMove: function (x, y) {
            if (this._viewportDragging) {
                var deltaX = this._viewportDragPos.x - x;
                var deltaY = this._viewportDragPos.y - y;

                // The goal is to trigger on a certain physical width, the
                // devicePixelRatio brings us a bit closer but is not optimal.
                var dragThreshold = 10 * (window.devicePixelRatio || 1);

                if (this._viewportHasMoved || (Math.abs(deltaX) > dragThreshold ||
                                               Math.abs(deltaY) > dragThreshold)) {
                    this._viewportHasMoved = true;

                    this._viewportDragPos = {'x': x, 'y': y};
                    this._display.viewportChangePos(deltaX, deltaY);
                    RFB.messages.fbUpdateRequests(this._sock, this._display.getCleanDirtyReset(), this._fb_width, this._fb_height);
                }

                // Skip sending mouse events
                return;
            }

            if (this._view_only) { return; } // View only, skip mouse events

            if (this._rfb_state !== "normal") { return; }
            RFB.messages.pointerEvent(this._sock, this._display.absX(x), this._display.absY(y), this._mouse_buttonMask);
        },

        // Message Handlers

        _negotiate_protocol_version: function () {
            if (this._sock.rQlen() < 12) {
                return this._fail("Incomplete protocol version");
            }

            var sversion = this._sock.rQshiftStr(12).substr(4, 7);
            Util.Info("Server ProtocolVersion: " + sversion);
            var is_repeater = 0;
            switch (sversion) {
                case "000.000":  // UltraVNC repeater
                    is_repeater = 1;
                    break;
                case "003.003":
                case "003.006":  // UltraVNC
                case "003.889":  // Apple Remote Desktop
                    this._rfb_version = 3.3;
                    break;
                case "003.007":
                    this._rfb_version = 3.7;
                    break;
                case "003.008":
                case "004.000":  // Intel AMT KVM
                case "004.001":  // RealVNC 4.6
                    this._rfb_version = 3.8;
                    break;
                default:
                    return this._fail("Invalid server version " + sversion);
            }

            if (is_repeater) {
                var repeaterID = this._repeaterID;
                while (repeaterID.length < 250) {
                    repeaterID += "\0";
                }
                this._sock.send_string(repeaterID);
                return true;
            }

            if (this._rfb_version > this._rfb_max_version) {
                this._rfb_version = this._rfb_max_version;
            }

            // Send updates either at a rate of 1 update per 50ms, or
            // whatever slower rate the network can handle
            this._sendTimer = setInterval(this._sock.flush.bind(this._sock), 50);

            var cversion = "00" + parseInt(this._rfb_version, 10) +
                           ".00" + ((this._rfb_version * 10) % 10);
            this._sock.send_string("RFB " + cversion + "\n");
            this._updateState('Security', 'Sent ProtocolVersion: ' + cversion);
        },

        _negotiate_security: function () {
            if (this._rfb_version >= 3.7) {
                // Server sends supported list, client decides
                var num_types = this._sock.rQshift8();
                if (this._sock.rQwait("security type", num_types, 1)) { return false; }

                if (num_types === 0) {
                    var strlen = this._sock.rQshift32();
                    var reason = this._sock.rQshiftStr(strlen);
                    return this._fail("Security failure: " + reason);
                }

                this._rfb_auth_scheme = 0;
                var types = this._sock.rQshiftBytes(num_types);
                Util.Debug("Server security types: " + types);
                for (var i = 0; i < types.length; i++) {
                    if (types[i] > this._rfb_auth_scheme && (types[i] <= 16 || types[i] == 22)) {
                        this._rfb_auth_scheme = types[i];
                    }
                }

                if (this._rfb_auth_scheme === 0) {
                    return this._fail("Unsupported security types: " + types);
                }

                this._sock.send([this._rfb_auth_scheme]);
            } else {
                // Server decides
                if (this._sock.rQwait("security scheme", 4)) { return false; }
                this._rfb_auth_scheme = this._sock.rQshift32();
            }

            this._updateState('Authentication', 'Authenticating using scheme: ' + this._rfb_auth_scheme);
            return this._init_msg(); // jump to authentication
        },

        // authentication
        _negotiate_xvp_auth: function () {
            var xvp_sep = this._xvp_password_sep;
            var xvp_auth = this._rfb_password.split(xvp_sep);
            if (xvp_auth.length < 3) {
                this._updateState('password', 'XVP credentials required (user' + xvp_sep +
                                  'target' + xvp_sep + 'password) -- got only ' + this._rfb_password);
                this._onPasswordRequired(this);
                return false;
            }

            var xvp_auth_str = String.fromCharCode(xvp_auth[0].length) +
                               String.fromCharCode(xvp_auth[1].length) +
                               xvp_auth[0] +
                               xvp_auth[1];
            this._sock.send_string(xvp_auth_str);
            this._rfb_password = xvp_auth.slice(2).join(xvp_sep);
            this._rfb_auth_scheme = 2;
            return this._negotiate_authentication();
        },

        _negotiate_std_vnc_auth: function () {
            if (this._rfb_password.length === 0) {
                // Notify via both callbacks since it's kind of
                // an RFB state change and a UI interface issue
                this._updateState('password', "Password Required");
                this._onPasswordRequired(this);
                return false;
            }

            if (this._sock.rQwait("auth challenge", 16)) { return false; }

            // TODO(directxman12): make genDES not require an Array
            var challenge = Array.prototype.slice.call(this._sock.rQshiftBytes(16));
            var response = RFB.genDES(this._rfb_password, challenge);
            this._sock.send(response);
            this._updateState("SecurityResult");
            return true;
        },

        _negotiate_tight_tunnels: function (numTunnels) {
            var clientSupportedTunnelTypes = {
                0: { vendor: 'TGHT', signature: 'NOTUNNEL' }
            };
            var serverSupportedTunnelTypes = {};
            // receive tunnel capabilities
            for (var i = 0; i < numTunnels; i++) {
                var cap_code = this._sock.rQshift32();
                var cap_vendor = this._sock.rQshiftStr(4);
                var cap_signature = this._sock.rQshiftStr(8);
                serverSupportedTunnelTypes[cap_code] = { vendor: cap_vendor, signature: cap_signature };
            }

            // choose the notunnel type
            if (serverSupportedTunnelTypes[0]) {
                if (serverSupportedTunnelTypes[0].vendor != clientSupportedTunnelTypes[0].vendor ||
                    serverSupportedTunnelTypes[0].signature != clientSupportedTunnelTypes[0].signature) {
                    return this._fail("Client's tunnel type had the incorrect vendor or signature");
                }
                this._sock.send([0, 0, 0, 0]);  // use NOTUNNEL
                return false; // wait until we receive the sub auth count to continue
            } else {
                return this._fail("Server wanted tunnels, but doesn't support the notunnel type");
            }
        },

        _negotiate_tight_auth: function () {
            if (!this._rfb_tightvnc) {  // first pass, do the tunnel negotiation
                if (this._sock.rQwait("num tunnels", 4)) { return false; }
                var numTunnels = this._sock.rQshift32();
                if (numTunnels > 0 && this._sock.rQwait("tunnel capabilities", 16 * numTunnels, 4)) { return false; }

                this._rfb_tightvnc = true;

                if (numTunnels > 0) {
                    this._negotiate_tight_tunnels(numTunnels);
                    return false;  // wait until we receive the sub auth to continue
                }
            }

            // second pass, do the sub-auth negotiation
            if (this._sock.rQwait("sub auth count", 4)) { return false; }
            var subAuthCount = this._sock.rQshift32();
            if (this._sock.rQwait("sub auth capabilities", 16 * subAuthCount, 4)) { return false; }

            var clientSupportedTypes = {
                'STDVNOAUTH__': 1,
                'STDVVNCAUTH_': 2
            };

            var serverSupportedTypes = [];

            for (var i = 0; i < subAuthCount; i++) {
                var capNum = this._sock.rQshift32();
                var capabilities = this._sock.rQshiftStr(12);
                serverSupportedTypes.push(capabilities);
            }

            for (var authType in clientSupportedTypes) {
                if (serverSupportedTypes.indexOf(authType) != -1) {
                    this._sock.send([0, 0, 0, clientSupportedTypes[authType]]);

                    switch (authType) {
                        case 'STDVNOAUTH__':  // no auth
                            this._updateState('SecurityResult');
                            return true;
                        case 'STDVVNCAUTH_': // VNC auth
                            this._rfb_auth_scheme = 2;
                            return this._init_msg();
                        default:
                            return this._fail("Unsupported tiny auth scheme: " + authType);
                    }
                }
            }

            this._fail("No supported sub-auth types!");
        },

        _negotiate_authentication: function () {
            switch (this._rfb_auth_scheme) {
                case 0:  // connection failed
                    if (this._sock.rQwait("auth reason", 4)) { return false; }
                    var strlen = this._sock.rQshift32();
                    var reason = this._sock.rQshiftStr(strlen);
                    return this._fail("Auth failure: " + reason);

                case 1:  // no auth
                    if (this._rfb_version >= 3.8) {
                        this._updateState('SecurityResult');
                        return true;
                    }
                    this._updateState('ClientInitialisation', "No auth required");
                    return this._init_msg();

                case 22:  // XVP auth
                    return this._negotiate_xvp_auth();

                case 2:  // VNC authentication
                    return this._negotiate_std_vnc_auth();

                case 16:  // TightVNC Security Type
                    return this._negotiate_tight_auth();

                default:
                    return this._fail("Unsupported auth scheme: " + this._rfb_auth_scheme);
            }
        },

        _handle_security_result: function () {
            if (this._sock.rQwait('VNC auth response ', 4)) { return false; }
            switch (this._sock.rQshift32()) {
                case 0:  // OK
                    this._updateState('ClientInitialisation', 'Authentication OK');
                    return this._init_msg();
                case 1:  // failed
                    if (this._rfb_version >= 3.8) {
                        var length = this._sock.rQshift32();
                        if (this._sock.rQwait("SecurityResult reason", length, 8)) { return false; }
                        var reason = this._sock.rQshiftStr(length);
                        return this._fail(reason);
                    } else {
                        return this._fail("Authentication failure");
                    }
                case 2:
                    return this._fail("Too many auth attempts");
            }
        },

        _negotiate_server_init: function () {
            if (this._sock.rQwait("server initialization", 24)) { return false; }

            /* Screen size */
            this._fb_width  = this._sock.rQshift16();
            this._fb_height = this._sock.rQshift16();
            this._destBuff = new Uint8Array(this._fb_width * this._fb_height * 4);

            /* PIXEL_FORMAT */
            var bpp         = this._sock.rQshift8();
            var depth       = this._sock.rQshift8();
            var big_endian  = this._sock.rQshift8();
            var true_color  = this._sock.rQshift8();

            var red_max     = this._sock.rQshift16();
            var green_max   = this._sock.rQshift16();
            var blue_max    = this._sock.rQshift16();
            var red_shift   = this._sock.rQshift8();
            var green_shift = this._sock.rQshift8();
            var blue_shift  = this._sock.rQshift8();
            this._sock.rQskipBytes(3);  // padding

            // NB(directxman12): we don't want to call any callbacks or print messages until
            //                   *after* we're past the point where we could backtrack

            /* Connection name/title */
            var name_length = this._sock.rQshift32();
            if (this._sock.rQwait('server init name', name_length, 24)) { return false; }
            this._fb_name = Util.decodeUTF8(this._sock.rQshiftStr(name_length));

            if (this._rfb_tightvnc) {
                if (this._sock.rQwait('TightVNC extended server init header', 8, 24 + name_length)) { return false; }
                // In TightVNC mode, ServerInit message is extended
                var numServerMessages = this._sock.rQshift16();
                var numClientMessages = this._sock.rQshift16();
                var numEncodings = this._sock.rQshift16();
                this._sock.rQskipBytes(2);  // padding

                var totalMessagesLength = (numServerMessages + numClientMessages + numEncodings) * 16;
                if (this._sock.rQwait('TightVNC extended server init header', totalMessagesLength, 32 + name_length)) { return false; }

                // we don't actually do anything with the capability information that TIGHT sends,
                // so we just skip the all of this.

                // TIGHT server message capabilities
                this._sock.rQskipBytes(16 * numServerMessages);

                // TIGHT client message capabilities
                this._sock.rQskipBytes(16 * numClientMessages);

                // TIGHT encoding capabilities
                this._sock.rQskipBytes(16 * numEncodings);
            }

            // NB(directxman12): these are down here so that we don't run them multiple times
            //                   if we backtrack
            Util.Info("Screen: " + this._fb_width + "x" + this._fb_height +
                      ", bpp: " + bpp + ", depth: " + depth +
                      ", big_endian: " + big_endian +
                      ", true_color: " + true_color +
                      ", red_max: " + red_max +
                      ", green_max: " + green_max +
                      ", blue_max: " + blue_max +
                      ", red_shift: " + red_shift +
                      ", green_shift: " + green_shift +
                      ", blue_shift: " + blue_shift);

            if (big_endian !== 0) {
                Util.Warn("Server native endian is not little endian");
            }

            if (red_shift !== 16) {
                Util.Warn("Server native red-shift is not 16");
            }

            if (blue_shift !== 0) {
                Util.Warn("Server native blue-shift is not 0");
            }

            // we're past the point where we could backtrack, so it's safe to call this
            this._onDesktopName(this, this._fb_name);

            if (this._true_color && this._fb_name === "Intel(r) AMT KVM") {
                Util.Warn("Intel AMT KVM only supports 8/16 bit depths.  Disabling true color");
                this._true_color = false;
            }

            this._display.set_true_color(this._true_color);
            this._display.resize(this._fb_width, this._fb_height);
            this._onFBResize(this, this._fb_width, this._fb_height);
            this._keyboard.grab();
            this._mouse.grab();

            if (this._true_color) {
                this._fb_Bpp = 4;
                this._fb_depth = 3;
            } else {
                this._fb_Bpp = 1;
                this._fb_depth = 1;
            }

            RFB.messages.pixelFormat(this._sock, this._fb_Bpp, this._fb_depth, this._true_color);
            RFB.messages.clientEncodings(this._sock, this._encodings, this._local_cursor, this._true_color);
            RFB.messages.fbUpdateRequests(this._sock, this._display.getCleanDirtyReset(), this._fb_width, this._fb_height);

            this._timing.fbu_rt_start = (new Date()).getTime();
            this._timing.pixels = 0;
            this._sock.flush();

            if (this._encrypt) {
                this._updateState('normal', 'Connected (encrypted) to: ' + this._fb_name);
            } else {
                this._updateState('normal', 'Connected (unencrypted) to: ' + this._fb_name);
            }
        },

        _init_msg: function () {
            switch (this._rfb_state) {
                case 'ProtocolVersion':
                    return this._negotiate_protocol_version();

                case 'Security':
                    return this._negotiate_security();

                case 'Authentication':
                    return this._negotiate_authentication();

                case 'SecurityResult':
                    return this._handle_security_result();

                case 'ClientInitialisation':
                    this._sock.send([this._shared ? 1 : 0]); // ClientInitialisation
                    this._updateState('ServerInitialisation', "Authentication OK");
                    return true;

                case 'ServerInitialisation':
                    return this._negotiate_server_init();
            }
        },

        _handle_set_colour_map_msg: function () {
            Util.Debug("SetColorMapEntries");
            this._sock.rQskip8();  // Padding

            var first_colour = this._sock.rQshift16();
            var num_colours = this._sock.rQshift16();
            if (this._sock.rQwait('SetColorMapEntries', num_colours * 6, 6)) { return false; }

            for (var c = 0; c < num_colours; c++) {
                var red = parseInt(this._sock.rQshift16() / 256, 10);
                var green = parseInt(this._sock.rQshift16() / 256, 10);
                var blue = parseInt(this._sock.rQshift16() / 256, 10);
                this._display.set_colourMap([blue, green, red], first_colour + c);
            }
            Util.Debug("colourMap: " + this._display.get_colourMap());
            Util.Info("Registered " + num_colours + " colourMap entries");

            return true;
        },

        _handle_server_cut_text: function () {
            Util.Debug("ServerCutText");
            if (this._sock.rQwait("ServerCutText header", 7, 1)) { return false; }
            this._sock.rQskipBytes(3);  // Padding
            var length = this._sock.rQshift32();
            if (this._sock.rQwait("ServerCutText", length, 8)) { return false; }

            // Read UTF-8 bytes directly from buffer
            var utf8Bytes = this._sock.rQshiftBytes(length);

            // Debug: log first few bytes
            Util.Debug("Clipboard data length: " + length);
            if (length > 0) {
                var debugStr = "First 20 bytes (hex): ";
                for (var i = 0; i < Math.min(20, utf8Bytes.length); i++) {
                    debugStr += utf8Bytes[i].toString(16).padStart(2, '0') + " ";
                }
                Util.Debug(debugStr);

                // 分析字节模式，猜测编码
                var asciiOnly = true;
                var utf8Likely = false;
                var highBytes = 0;

                for (var i = 0; i < Math.min(50, utf8Bytes.length); i++) {
                    var b = utf8Bytes[i];
                    if (b > 127) {
                        asciiOnly = false;
                        highBytes++;
                    }

                    // 检查 UTF-8 多字节序列模式
                    if (b >= 0xC0 && b <= 0xDF && i + 1 < utf8Bytes.length) {
                        var b2 = utf8Bytes[i + 1];
                        if (b2 >= 0x80 && b2 <= 0xBF) {
                            utf8Likely = true;
                        }
                    } else if (b >= 0xE0 && b <= 0xEF && i + 2 < utf8Bytes.length) {
                        var b2 = utf8Bytes[i + 1];
                        var b3 = utf8Bytes[i + 2];
                        if (b2 >= 0x80 && b2 <= 0xBF && b3 >= 0x80 && b3 <= 0xBF) {
                            utf8Likely = true;
                        }
                    }
                }

                Util.Debug("编码分析:");
                Util.Debug("  ASCII only: " + asciiOnly);
                Util.Debug("  High bytes (>127): " + highBytes + "/" + Math.min(50, utf8Bytes.length));
                Util.Debug("  UTF-8 likely: " + utf8Likely);

                // 如果是纯 ASCII，直接转换为字符串查看
                if (asciiOnly) {
                    var asciiStr = '';
                    for (var i = 0; i < Math.min(50, utf8Bytes.length); i++) {
                        asciiStr += String.fromCharCode(utf8Bytes[i]);
                    }
                    Util.Debug("ASCII 文本预览: " + asciiStr);
                }
            }

            // Skip UTF-8 BOM if present (EF BB BF)
            var startIdx = 0;
            if (utf8Bytes.length >= 3 && utf8Bytes[0] === 0xEF &&
                utf8Bytes[1] === 0xBB && utf8Bytes[2] === 0xBF) {
                startIdx = 3;
                Util.Debug("Skipped UTF-8 BOM");
            }

            var dataToDecode = startIdx > 0 ? utf8Bytes.subarray(startIdx) : utf8Bytes;

            // Decode bytes to string using multiple encoding detection
            var text;
            var encoding = this._clipboardEncoding || 'auto';
            Util.Debug("Using clipboard encoding: " + encoding);

            // 如果指定了编码，直接使用该编码
            if (encoding !== 'auto') {
                if (typeof TextDecoder !== 'undefined') {
                    try {
                        // 首先尝试浏览器原生支持的编码
                        var decoder = new TextDecoder(encoding);
                        text = decoder.decode(dataToDecode);
                        Util.Debug("Decoded with specified encoding (" + encoding + "): " + text.substring(0, 50));
                    } catch (e) {
                        Util.Error("Failed to decode with encoding " + encoding + ": " + e);
                        // 如果浏览器不支持该编码，尝试 GBK/GB2312
                        if (encoding === 'gbk' || encoding === 'gb2312') {
                            text = this._decodeGBK(dataToDecode);
                            if (text) {
                                Util.Debug("Decoded with GBK/GB2312 (fallback): " + text.substring(0, 50));
                            }
                        }
                    }
                } else if (encoding === 'gbk' || encoding === 'gb2312') {
                    // TextDecoder 不可用，使用自定义 GBK 解码
                    text = this._decodeGBK(dataToDecode);
                    if (text) {
                        Util.Debug("Decoded with GBK/GB2312 (custom): " + text.substring(0, 50));
                    }
                }
            }

            // 如果自动检测或指定编码失败，继续自动检测
            if (!text) {
                // 首先检测数据是否为有效的 UTF-8
                var isLikelyUTF8 = this._isLikelyUTF8(dataToDecode);
                var isLikelyLatin1 = this._isLikelyLatin1(dataToDecode);

                Util.Debug("编码可能性检测:");
                Util.Debug("  可能是 UTF-8: " + isLikelyUTF8);
                Util.Debug("  可能是 Latin-1: " + isLikelyLatin1);

                if (typeof TextDecoder !== 'undefined') {
                    // 优先尝试 UTF-8（如果数据看起来像 UTF-8）
                    if (isLikelyUTF8 || (!isLikelyLatin1 && isLikelyUTF8)) {
                        try {
                            var decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
                            var utf8Text = decoder.decode(dataToDecode);

                            // 检查解码结果是否合理
                            if (this._isReasonableText(utf8Text)) {
                                text = utf8Text;
                                Util.Debug("使用 UTF-8 解码: " + text.substring(0, 50));
                            } else {
                                Util.Debug("UTF-8 解码结果不合理，尝试 Latin-1");
                            }
                        } catch (e) {
                            Util.Error("TextDecoder UTF-8 error: " + e);
                        }
                    }

                    // 如果 UTF-8 失败或数据看起来像 Latin-1，尝试 Latin-1
                    if (!text && (isLikelyLatin1 || !isLikelyUTF8)) {
                        try {
                            var decoder = new TextDecoder('iso-8859-1');
                            var latin1Text = decoder.decode(dataToDecode);

                            // 检查这是否是误解码的 UTF-8（即包含 ä½ å¥½ 这样的字符）
                            if (this._isMisdecodedUTF8(latin1Text, dataToDecode)) {
                                Util.Debug("检测到 Latin-1 解码可能是误解码的 UTF-8");
                                // 尝试用 UTF-8 重新解码
                                try {
                                    var decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
                                    text = decoder.decode(dataToDecode);
                                    Util.Debug("重新用 UTF-8 解码: " + text.substring(0, 50));
                                } catch (e) {
                                    // 如果 UTF-8 失败，使用 Latin-1
                                    text = latin1Text;
                                    Util.Debug("使用 Latin-1 解码: " + text.substring(0, 50));
                                }
                            } else {
                                text = latin1Text;
                                Util.Debug("使用 Latin-1 解码: " + text.substring(0, 50));
                            }
                        } catch (e) {
                            Util.Error("TextDecoder Latin-1 error: " + e);
                        }
                    }
                }
            }
            
            // If TextDecoder failed or not available, try Util.decodeUTF8
            if (!text && typeof Util.decodeUTF8 !== 'undefined') {
                try {
                    // Convert bytes to Latin-1 string for Util.decodeUTF8
                    var latin1String = '';
                    for (var i = 0; i < dataToDecode.length; i++) {
                        latin1String += String.fromCharCode(dataToDecode[i]);
                    }
                    text = Util.decodeUTF8(latin1String);
                    Util.Debug("Decoded clipboard text (Util.decodeUTF8): " + text.substring(0, 50));
                    // Debug: show character codes
                    var charCodes = [];
                    for (var j = 0; j < Math.min(10, text.length); j++) {
                        charCodes.push(text.charCodeAt(j).toString(16));
                    }
                    Util.Debug("First 10 char codes (hex): " + charCodes.join(" "));
                } catch (e) {
                    Util.Error("Util.decodeUTF8 error: " + e);
                }
            }
            
            // Last resort: manual UTF-8 decoding
            if (!text) {
                text = '';
                var i = 0;
                while (i < dataToDecode.length) {
                    var byte1 = dataToDecode[i++];
                    if (byte1 < 0x80) {
                        text += String.fromCharCode(byte1);
                    } else if ((byte1 >> 5) === 0x06) {
                        if (i >= dataToDecode.length) break;
                        var byte2 = dataToDecode[i++];
                        if ((byte2 & 0xC0) !== 0x80) {
                            i--;
                            text += String.fromCharCode(0xFFFD);
                            continue;
                        }
                        text += String.fromCharCode(((byte1 & 0x1F) << 6) | (byte2 & 0x3F));
                    } else if ((byte1 >> 4) === 0x0E) {
                        if (i + 1 >= dataToDecode.length) break;
                        var byte2 = dataToDecode[i++];
                        var byte3 = dataToDecode[i++];
                        if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80) {
                            i -= 2;
                            text += String.fromCharCode(0xFFFD);
                            continue;
                        }
                        text += String.fromCharCode(((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F));
                    } else if ((byte1 >> 3) === 0x1E) {
                        if (i + 2 >= dataToDecode.length) break;
                        var byte2 = dataToDecode[i++];
                        var byte3 = dataToDecode[i++];
                        var byte4 = dataToDecode[i++];
                        if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80 || (byte4 & 0xC0) !== 0x80) {
                            i -= 3;
                            text += String.fromCharCode(0xFFFD);
                            continue;
                        }
                        var codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F);
                        codePoint -= 0x10000;
                        text += String.fromCharCode(0xD800 + (codePoint >> 10));
                        text += String.fromCharCode(0xDC00 + (codePoint & 0x3FF));
                    } else {
                        text += String.fromCharCode(0xFFFD);
                    }
                }
                Util.Debug("Decoded clipboard text (manual): " + text.substring(0, 50));
                // Debug: show character codes
                var charCodes = [];
                for (var j = 0; j < Math.min(10, text.length); j++) {
                    charCodes.push(text.charCodeAt(j).toString(16));
                }
                Util.Debug("First 10 char codes (hex): " + charCodes.join(" "));
            }
            
            if (!text) {
                text = '';
                Util.Warn("Failed to decode clipboard text");
            }

            // Debug: check text content before calling callback
            Util.Debug("Text to send to onClipboard callback:");
            Util.Debug("  Raw text: " + text);
            Util.Debug("  Text length: " + text.length);
            Util.Debug("  Contains backslash-u: " + (text.indexOf('\\u') !== -1));
            Util.Debug("  Contains backslash: " + (text.indexOf('\\') !== -1));

            // Check if text contains literal \u sequences
            if (text.indexOf('\\u') !== -1) {
                Util.Warn("Text contains literal \\u sequences - may be double-encoded");
                // Try to decode \u sequences
                try {
                    var decoded = JSON.parse('"' + text.replace(/"/g, '\\"') + '"');
                    Util.Debug("After JSON.parse decoding: " + decoded.substring(0, 50));
                    text = decoded;
                } catch (e) {
                    Util.Error("Failed to decode \\u sequences: " + e);
                }
            }

            // 检查是否是 UTF-8 被 Latin-1 误解码的模式
            // 注意：ä½å¥½ 是 "你好" 的 UTF-8 字节被 Latin-1 解码的结果
            // UTF-8 字节: e4 bd a0 e5 a5 bd
            // Latin-1 解码: ä½å¥½

            // 更灵活的检测：检查是否包含典型的误解码字符
            var misdecodedChars = ['ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï'];
            var misdecodedCharCount = 0;

            for (var i = 0; i < text.length; i++) {
                var char = text[i];
                if (misdecodedChars.includes(char)) {
                    misdecodedCharCount++;
                }
            }

            // 如果文本中超过 20% 的字符是典型的误解码字符，则认为是误解码
            var misdecodedRatio = misdecodedCharCount / Math.max(1, text.length);
            var isMisdecoded = misdecodedRatio > 0.2;

            Util.Debug("误解码字符检测:");
            Util.Debug("  文本长度: " + text.length);
            Util.Debug("  误解码字符数: " + misdecodedCharCount);
            Util.Debug("  误解码比例: " + misdecodedRatio.toFixed(2));
            Util.Debug("  判断为误解码: " + isMisdecoded);
                /æ°/,        // 数
                /è¿/,        // 返
                /å/,        // 回
                /å¼/,        // 值
                /è¯­/,        // 语
                /è¨/,        // 言
                /ç¼/,        // 编
                /ç /,        // 码
                /è§£/,        // 解
                /ç /,        // 码
                /é/,        // 错
                /è¯¯/,        // 误
                /ä¿®/,        // 修
                /å¤/,        // 复
                /æµ/,        // 测
                /è¯/,        // 试
                /ç»/,        // 结
                /æ/,        // 果
                /æ/,        // 文
                /æ¡£/,        // 档
                /è¯´/,        // 说
                /æ/,        // 明
                /å/,        // 功
                /è½/,        // 能
                /æ§/,        // 控
                /å¶/,        // 制
                /ç³»/,        // 系
                /ç»/,        // 统
                /è®¾/,        // 设
                /å¤/,        // 备
                /è¿/,        // 连
                /æ¥/,        // 接
                /é/,        // 通
                /ä¿¡/,        // 信
                /å/,        // 协
                /è®®/,        // 议
                /æ°/,        // 数
                /æ®/,        // 据
                /åº/,        // 库
                /æ/,        // 服
                /å¡/,        // 务
                /å¨/,        // 器
                /å®¢/,        // 客
                /æ·/,        // 户
                /ç«¯/,        // 端
                /ç½/,        // 网
                /é¡µ/,        // 页
                /å¾/,        // 图
                /ç/,        // 片
                /é³/,        // 音
                /é¢/,        // 频
                /è§/,        // 视
                /é¢/,        // 频
                /å¨/,        // 动
                /ç»/,        // 画
                /æ/,        // 手
                /æº/,        // 机
                /çµ/,        // 电
                /è/,        // 脑
                /å¹³/,        // 平
                /æ¿/,        // 板
                /è®¾/,        // 设
                /è®¡/,        // 计
                /å¼/,        // 开
                /å/,        // 发
                /è½¯/,        // 软
                /ä»¶/,        // 件
                /ç¡¬/,        // 硬
                /ä»¶/,        // 件
                /ç½/,        // 网
                /ç»/,        // 络
                /å®/,        // 安
                /å¨/,        // 全
                /ä¿/,        // 保
                /é/,        // 障
                /ç®¡/,        // 管
                /ç/,        // 理
                /æ/,        // 服
                /å¡/,        // 务
                /å¨/,        // 器
                /å®¢/,        // 客
                /æ·/,        // 户
                /ç«¯/,        // 端
                /ç½/,        // 网
                /é¡µ/,        // 页
                /å¾/,        // 图
                /ç/,        // 片
                /é³/,        // 音
                /é¢/,        // 频
                /è§/,        // 视
                /é¢/,        // 频
                /å¨/,        // 动
                /ç»/,        // 画
                /æ/,        // 手
                /æº/,        // 机
                /çµ/,        // 电
                /è/,        // 脑
                /å¹³/,        // 平
                /æ¿/,        // 板
                /è®¾/,        // 设
                /è®¡/,        // 计
                /å¼/,        // 开
                /å/,        // 发
                /è½¯/,        // 软
                /ä»¶/,        // 件
                /ç¡¬/,        // 硬
                /ä»¶/,        // 件
                /ç½/,        // 网
                /ç»/,        // 络
                /å®/,        // 安
                /å¨/,        // 全
                /ä¿/,        // 保
                /é/,        // 障
                /ç®¡/,        // 管
                /ç/,        // 理
            ];

            var isMisdecoded = false;
            for (var i = 0; i < misdecodedPatterns.length; i++) {
                if (misdecodedPatterns[i].test(text)) {
                    isMisdecoded = true;
                    Util.Warn("检测到 UTF-8 被 Latin-1 误解码模式: " + misdecodedPatterns[i].toString());
                    break;
                }
            }

            // 如果检测到误解码模式，尝试修复
            if (isMisdecoded && typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined') {
                Util.Warn("尝试修复 UTF-8 被 Latin-1 误解码的文本...");

                // 方法1: 将误解码的文本重新编码为 Latin-1 字节，然后用 UTF-8 解码
                try {
                    // TextEncoder 默认使用 UTF-8，所以需要手动转换为 Latin-1 字节
                    var latin1Bytes = new Uint8Array(text.length);
                    for (var i = 0; i < text.length; i++) {
                        var code = text.charCodeAt(i);
                        // Latin-1 只能表示 0-255，但误解码的字符可能超过这个范围
                        latin1Bytes[i] = code & 0xFF;
                    }

                    Util.Debug("Latin-1 字节 (十六进制): ");
                    var hexStr = "";
                    for (var i = 0; i < Math.min(20, latin1Bytes.length); i++) {
                        hexStr += latin1Bytes[i].toString(16).padStart(2, '0') + " ";
                    }
                    Util.Debug(hexStr);

                    // 将 Latin-1 字节转换为 UTF-8 字符串
                    var decoder = new TextDecoder('utf-8');
                    var fixedText = decoder.decode(latin1Bytes);

                    Util.Debug("修复前: " + text.substring(0, 50));
                    Util.Debug("修复后: " + fixedText.substring(0, 50));

                    // 检查修复后的文本是否合理
                    if (this._isReasonableText(fixedText)) {
                        text = fixedText;
                        Util.Info("成功修复 UTF-8 被 Latin-1 误解码的文本");
                    } else {
                        Util.Warn("修复后的文本不合理，保持原文本");
                    }
                } catch (e) {
                    Util.Error("修复 UTF-8 被 Latin-1 误解码失败: " + e);
                }
            }

            this._onClipboard(this, text);

            return true;
        },

        _handle_xvp_msg: function () {
            if (this._sock.rQwait("XVP version and message", 3, 1)) { return false; }
            this._sock.rQskip8();  // Padding
            var xvp_ver = this._sock.rQshift8();
            var xvp_msg = this._sock.rQshift8();

            switch (xvp_msg) {
                case 0:  // XVP_FAIL
                    this._updateState(this._rfb_state, "Operation Failed");
                    break;
                case 1:  // XVP_INIT
                    this._rfb_xvp_ver = xvp_ver;
                    Util.Info("XVP extensions enabled (version " + this._rfb_xvp_ver + ")");
                    this._onXvpInit(this._rfb_xvp_ver);
                    break;
                default:
                    this._fail("Disconnected: illegal server XVP message " + xvp_msg);
                    break;
            }

            return true;
        },

        _normal_msg: function () {
            var msg_type;

            if (this._FBU.rects > 0) {
                msg_type = 0;
            } else {
                msg_type = this._sock.rQshift8();
            }

            switch (msg_type) {
                case 0:  // FramebufferUpdate
                    var ret = this._framebufferUpdate();
                    if (ret) {
                        RFB.messages.fbUpdateRequests(this._sock, this._display.getCleanDirtyReset(), this._fb_width, this._fb_height);
                        this._sock.flush();
                    }
                    return ret;

                case 1:  // SetColorMapEntries
                    return this._handle_set_colour_map_msg();

                case 2:  // Bell
                    Util.Debug("Bell");
                    this._onBell(this);
                    return true;

                case 3:  // ServerCutText
                    return this._handle_server_cut_text();

                case 250:  // XVP
                    return this._handle_xvp_msg();

                default:
                    this._fail("Disconnected: illegal server message type " + msg_type);
                    Util.Debug("sock.rQslice(0, 30): " + this._sock.rQslice(0, 30));
                    return true;
            }
        },

        _framebufferUpdate: function () {
            var ret = true;
            var now;

            if (this._FBU.rects === 0) {
                if (this._sock.rQwait("FBU header", 3, 1)) { return false; }
                this._sock.rQskip8();  // Padding
                this._FBU.rects = this._sock.rQshift16();
                this._FBU.bytes = 0;
                this._timing.cur_fbu = 0;
                if (this._timing.fbu_rt_start > 0) {
                    now = (new Date()).getTime();
                    Util.Info("First FBU latency: " + (now - this._timing.fbu_rt_start));
                }
            }

            while (this._FBU.rects > 0) {
                if (this._rfb_state !== "normal") { return false; }

                if (this._sock.rQwait("FBU", this._FBU.bytes)) { return false; }
                if (this._FBU.bytes === 0) {
                    if (this._sock.rQwait("rect header", 12)) { return false; }
                    /* New FramebufferUpdate */

                    var hdr = this._sock.rQshiftBytes(12);
                    this._FBU.x        = (hdr[0] << 8) + hdr[1];
                    this._FBU.y        = (hdr[2] << 8) + hdr[3];
                    this._FBU.width    = (hdr[4] << 8) + hdr[5];
                    this._FBU.height   = (hdr[6] << 8) + hdr[7];
                    this._FBU.encoding = parseInt((hdr[8] << 24) + (hdr[9] << 16) +
                                                  (hdr[10] << 8) + hdr[11], 10);

                    this._onFBUReceive(this,
                        {'x': this._FBU.x, 'y': this._FBU.y,
                         'width': this._FBU.width, 'height': this._FBU.height,
                         'encoding': this._FBU.encoding,
                         'encodingName': this._encNames[this._FBU.encoding]});

                    if (!this._encNames[this._FBU.encoding]) {
                        this._fail("Disconnected: unsupported encoding " +
                                   this._FBU.encoding);
                        return false;
                    }
                }

                this._timing.last_fbu = (new Date()).getTime();

                var handler = this._encHandlers[this._FBU.encoding];
                try {
                    //ret = this._encHandlers[this._FBU.encoding]();
                    ret = handler();
                } catch (ex)  {
                    Util.Error("Encoding handler error for " + this._FBU.encoding + ": " + ex);
                    return this._fail("Encoding handler failed: " + this._FBU.encoding);
                }

                now = (new Date()).getTime();
                this._timing.cur_fbu += (now - this._timing.last_fbu);

                if (ret) {
                    this._encStats[this._FBU.encoding][0]++;
                    this._encStats[this._FBU.encoding][1]++;
                    this._timing.pixels += this._FBU.width * this._FBU.height;
                }

                if (this._timing.pixels >= (this._fb_width * this._fb_height)) {
                    if ((this._FBU.width === this._fb_width && this._FBU.height === this._fb_height) ||
                        this._timing.fbu_rt_start > 0) {
                        this._timing.full_fbu_total += this._timing.cur_fbu;
                        this._timing.full_fbu_cnt++;
                        Util.Info("Timing of full FBU, curr: " +
                                  this._timing.cur_fbu + ", total: " +
                                  this._timing.full_fbu_total + ", cnt: " +
                                  this._timing.full_fbu_cnt + ", avg: " +
                                  (this._timing.full_fbu_total / this._timing.full_fbu_cnt));
                    }

                    if (this._timing.fbu_rt_start > 0) {
                        var fbu_rt_diff = now - this._timing.fbu_rt_start;
                        this._timing.fbu_rt_total += fbu_rt_diff;
                        this._timing.fbu_rt_cnt++;
                        Util.Info("full FBU round-trip, cur: " +
                                  fbu_rt_diff + ", total: " +
                                  this._timing.fbu_rt_total + ", cnt: " +
                                  this._timing.fbu_rt_cnt + ", avg: " +
                                  (this._timing.fbu_rt_total / this._timing.fbu_rt_cnt));
                        this._timing.fbu_rt_start = 0;
                    }
                }

                if (!ret) { return ret; }  // need more data
            }

            this._onFBUComplete(this,
                    {'x': this._FBU.x, 'y': this._FBU.y,
                     'width': this._FBU.width, 'height': this._FBU.height,
                     'encoding': this._FBU.encoding,
                     'encodingName': this._encNames[this._FBU.encoding]});

            return true;  // We finished this FBU
        },
    };

    Util.make_properties(RFB, [
        ['target', 'wo', 'dom'],                // VNC display rendering Canvas object
        ['focusContainer', 'wo', 'dom'],        // DOM element that captures keyboard input
        ['encrypt', 'rw', 'bool'],              // Use TLS/SSL/wss encryption
        ['true_color', 'rw', 'bool'],           // Request true color pixel data
        ['local_cursor', 'rw', 'bool'],         // Request locally rendered cursor
        ['shared', 'rw', 'bool'],               // Request shared mode
        ['view_only', 'rw', 'bool'],            // Disable client mouse/keyboard
        ['xvp_password_sep', 'rw', 'str'],      // Separator for XVP password fields
        ['disconnectTimeout', 'rw', 'int'],     // Time (s) to wait for disconnection
        ['wsProtocols', 'rw', 'arr'],           // Protocols to use in the WebSocket connection
        ['repeaterID', 'rw', 'str'],            // [UltraVNC] RepeaterID to connect to
        ['viewportDrag', 'rw', 'bool'],         // Move the viewport on mouse drags
        ['clipboardEncoding', 'rw', 'str'],     // Clipboard encoding: 'auto', 'utf-8', 'latin-1', 'gbk', 'gb2312'

        // Callback functions
        ['onUpdateState', 'rw', 'func'],        // onUpdateState(rfb, state, oldstate, statusMsg): RFB state update/change
        ['onPasswordRequired', 'rw', 'func'],   // onPasswordRequired(rfb): VNC password is required
        ['onClipboard', 'rw', 'func'],          // onClipboard(rfb, text): RFB clipboard contents received
        ['onBell', 'rw', 'func'],               // onBell(rfb): RFB Bell message received
        ['onFBUReceive', 'rw', 'func'],         // onFBUReceive(rfb, fbu): RFB FBU received but not yet processed
        ['onFBUComplete', 'rw', 'func'],        // onFBUComplete(rfb, fbu): RFB FBU received and processed
        ['onFBResize', 'rw', 'func'],           // onFBResize(rfb, width, height): frame buffer resized
        ['onDesktopName', 'rw', 'func'],        // onDesktopName(rfb, name): desktop name received
        ['onXvpInit', 'rw', 'func'],            // onXvpInit(version): XVP extensions active for this connection
    ]);

    RFB.prototype.set_local_cursor = function (cursor) {
        if (!cursor || (cursor in {'0': 1, 'no': 1, 'false': 1})) {
            this._local_cursor = false;
            this._display.disableLocalCursor(); //Only show server-side cursor
        } else {
            if (this._display.get_cursor_uri()) {
                this._local_cursor = true;
            } else {
                Util.Warn("Browser does not support local cursor");
                this._display.disableLocalCursor();
            }
        }
    };

    RFB.prototype.get_display = function () { return this._display; };
    RFB.prototype.get_keyboard = function () { return this._keyboard; };
    RFB.prototype.get_mouse = function () { return this._mouse; };

    // Class Methods
    RFB.messages = {
        keyEvent: function (sock, keysym, down) {
            var buff = sock._sQ;
            var offset = sock._sQlen;

            buff[offset] = 4;  // msg-type
            buff[offset + 1] = down;

            buff[offset + 2] = 0;
            buff[offset + 3] = 0;

            buff[offset + 4] = (keysym >> 24);
            buff[offset + 5] = (keysym >> 16);
            buff[offset + 6] = (keysym >> 8);
            buff[offset + 7] = keysym;

            sock._sQlen += 8;
        },

        pointerEvent: function (sock, x, y, mask) {
            var buff = sock._sQ;
            var offset = sock._sQlen;

            buff[offset] = 5; // msg-type

            buff[offset + 1] = mask;

            buff[offset + 2] = x >> 8;
            buff[offset + 3] = x;

            buff[offset + 4] = y >> 8;
            buff[offset + 5] = y;

            sock._sQlen += 6;
        },

        // UTF-8 compatible clipboard text sending
        clientCutText: function (sock, text) {
            var buff = sock._sQ;
            var offset = sock._sQlen;

            buff[offset] = 6; // msg-type

            buff[offset + 1] = 0; // padding
            buff[offset + 2] = 0; // padding
            buff[offset + 3] = 0; // padding

            // Debug: log original text
            Util.Debug("=== clientCutText 开始 ===");
            Util.Debug("原始文本: " + text);
            Util.Debug("文本长度: " + text.length + " 字符");

            // 显示前10个字符的字符码
            Util.Debug("前10个字符码 (十六进制):");
            for (var i = 0; i < Math.min(10, text.length); i++) {
                Util.Debug("  [" + i + "]: 0x" + text.charCodeAt(i).toString(16) + " (" + text.charCodeAt(i) + ")");
            }

            Util.Debug("包含 \\\\u 序列: " + (text.indexOf('\\u') !== -1));
            Util.Debug("包含反斜杠: " + (text.indexOf('\\') !== -1));

            // 检查文本是否已经是 Unicode 转义序列（如 \u63d0\u793a\u8bcd）
            // 注意：这里要区分是字面量的 \u 序列还是正常的 Unicode 字符
            if (text.indexOf('\\u') !== -1) {
                // 检查是否是真正的字面量 \u 序列（如 "\\u63d0\\u793a\\u8bcd"）
                // 而不是包含 "u" 字符的正常文本
                var hasLiteralUnicode = /\\u[0-9a-fA-F]{4}/.test(text);
                Util.Debug("检测到字面量 \\\\u 序列: " + hasLiteralUnicode);

                if (hasLiteralUnicode) {
                    Util.Warn("输入文本包含字面量 \\\\u 转义序列 - 尝试解码");
                    try {
                        var decoded = JSON.parse('"' + text.replace(/"/g, '\\"') + '"');
                        Util.Debug("从 \\\\u 序列解码后: " + decoded.substring(0, 50));

                        // 显示解码后的字符码
                        Util.Debug("解码后前10个字符码:");
                        for (var i = 0; i < Math.min(10, decoded.length); i++) {
                            Util.Debug("  [" + i + "]: 0x" + decoded.charCodeAt(i).toString(16));
                        }

                        text = decoded;
                    } catch (e) {
                        Util.Error("解码 \\\\u 序列失败: " + e);
                    }
                } else {
                    Util.Debug("文本包含 '\\\\u' 但不是有效的 Unicode 转义序列，保持原样");
                }
            }

            // Encode text to UTF-8 bytes
            var utf8Bytes;
            if (typeof TextEncoder !== 'undefined') {
                // Use native TextEncoder if available (modern browsers)
                var encoder = new TextEncoder();
                utf8Bytes = encoder.encode(text);
            } else {
                // Manual UTF-8 encoding for older browsers
                utf8Bytes = [];
                for (var i = 0; i < text.length; i++) {
                    var code = text.charCodeAt(i);
                    if (code < 0x80) {
                        utf8Bytes.push(code);
                    } else if (code < 0x800) {
                        utf8Bytes.push(0xC0 | (code >> 6));
                        utf8Bytes.push(0x80 | (code & 0x3F));
                    } else if (code < 0xD800 || code >= 0xE000) {
                        utf8Bytes.push(0xE0 | (code >> 12));
                        utf8Bytes.push(0x80 | ((code >> 6) & 0x3F));
                        utf8Bytes.push(0x80 | (code & 0x3F));
                    } else {
                        // Surrogate pair
                        i++;
                        code = 0x10000 + (((code & 0x3FF) << 10) | (text.charCodeAt(i) & 0x3FF));
                        utf8Bytes.push(0xF0 | (code >> 18));
                        utf8Bytes.push(0x80 | ((code >> 12) & 0x3F));
                        utf8Bytes.push(0x80 | ((code >> 6) & 0x3F));
                        utf8Bytes.push(0x80 | (code & 0x3F));
                    }
                }
            }

            // Debug: log encoded bytes
            if (utf8Bytes.length > 0) {
                var debugStr = "Encoded bytes (first 20): ";
                for (var i = 0; i < Math.min(20, utf8Bytes.length); i++) {
                    debugStr += utf8Bytes[i].toString(16).padStart(2, '0') + " ";
                }
                Util.Debug(debugStr);
            }

            var n = utf8Bytes.length;

            buff[offset + 4] = n >> 24;
            buff[offset + 5] = n >> 16;
            buff[offset + 6] = n >> 8;
            buff[offset + 7] = n;

            for (var j = 0; j < n; j++) {
                buff[offset + 8 + j] = utf8Bytes[j];
            }

            sock._sQlen += 8 + n;
        },

        setDesktopSize: function (sock, width, height, id, flags) {
            var buff = sock._sQ;
            var offset = sock._sQlen;

            buff[offset] = 251;              // msg-type
            buff[offset + 1] = 0;            // padding
            buff[offset + 2] = width >> 8;   // width
            buff[offset + 3] = width;
            buff[offset + 4] = height >> 8;  // height
            buff[offset + 5] = height;

            buff[offset + 6] = 1;            // number-of-screens
            buff[offset + 7] = 0;            // padding

            // screen array
            buff[offset + 8] = id >> 24;     // id
            buff[offset + 9] = id >> 16;
            buff[offset + 10] = id >> 8;
            buff[offset + 11] = id;
            buff[offset + 12] = 0;           // x-position
            buff[offset + 13] = 0;
            buff[offset + 14] = 0;           // y-position
            buff[offset + 15] = 0;
            buff[offset + 16] = width >> 8;  // width
            buff[offset + 17] = width;
            buff[offset + 18] = height >> 8; // height
            buff[offset + 19] = height;
            buff[offset + 20] = flags >> 24; // flags
            buff[offset + 21] = flags >> 16;
            buff[offset + 22] = flags >> 8;
            buff[offset + 23] = flags;

            sock._sQlen += 24;
        },

        pixelFormat: function (sock, bpp, depth, true_color) {
            var buff = sock._sQ;
            var offset = sock._sQlen;

            buff[offset] = 0;  // msg-type

            buff[offset + 1] = 0; // padding
            buff[offset + 2] = 0; // padding
            buff[offset + 3] = 0; // padding

            buff[offset + 4] = bpp * 8;             // bits-per-pixel
            buff[offset + 5] = depth * 8;           // depth
            buff[offset + 6] = 0;                   // little-endian
            buff[offset + 7] = true_color ? 1 : 0;  // true-color

            buff[offset + 8] = 0;    // red-max
            buff[offset + 9] = 255;  // red-max

            buff[offset + 10] = 0;   // green-max
            buff[offset + 11] = 255; // green-max

            buff[offset + 12] = 0;   // blue-max
            buff[offset + 13] = 255; // blue-max

            buff[offset + 14] = 16;  // red-shift
            buff[offset + 15] = 8;   // green-shift
            buff[offset + 16] = 0;   // blue-shift

            buff[offset + 17] = 0;   // padding
            buff[offset + 18] = 0;   // padding
            buff[offset + 19] = 0;   // padding

            sock._sQlen += 20;
        },

        clientEncodings: function (sock, encodings, local_cursor, true_color) {
            var buff = sock._sQ;
            var offset = sock._sQlen;

            buff[offset] = 2; // msg-type
            buff[offset + 1] = 0; // padding

            // offset + 2 and offset + 3 are encoding count

            var i, j = offset + 4, cnt = 0;
            for (i = 0; i < encodings.length; i++) {
                if (encodings[i][0] === "Cursor" && !local_cursor) {
                    Util.Debug("Skipping Cursor pseudo-encoding");
                } else if (encodings[i][0] === "TIGHT" && !true_color) {
                    // TODO: remove this when we have tight+non-true-color
                    Util.Warn("Skipping tight as it is only supported with true color");
                } else {
                    var enc = encodings[i][1];
                    buff[j] = enc >> 24;
                    buff[j + 1] = enc >> 16;
                    buff[j + 2] = enc >> 8;
                    buff[j + 3] = enc;

                    j += 4;
                    cnt++;
                }
            }

            buff[offset + 2] = cnt >> 8;
            buff[offset + 3] = cnt;

            sock._sQlen += j - offset;
        },

        fbUpdateRequests: function (sock, cleanDirty, fb_width, fb_height) {
            var offsetIncrement = 0;

            var cb = cleanDirty.cleanBox;
            var w, h;
            if (cb.w > 0 && cb.h > 0) {
                w = typeof cb.w === "undefined" ? fb_width : cb.w;
                h = typeof cb.h === "undefined" ? fb_height : cb.h;
                // Request incremental for clean box
                RFB.messages.fbUpdateRequest(sock, 1, cb.x, cb.y, w, h);
            }

            for (var i = 0; i < cleanDirty.dirtyBoxes.length; i++) {
                var db = cleanDirty.dirtyBoxes[i];
                // Force all (non-incremental) for dirty box
                w = typeof db.w === "undefined" ? fb_width : db.w;
                h = typeof db.h === "undefined" ? fb_height : db.h;
                RFB.messages.fbUpdateRequest(sock, 0, db.x, db.y, w, h);
            }
        },

        fbUpdateRequest: function (sock, incremental, x, y, w, h) {
            var buff = sock._sQ;
            var offset = sock._sQlen;

            if (typeof(x) === "undefined") { x = 0; }
            if (typeof(y) === "undefined") { y = 0; }

            buff[offset] = 3;  // msg-type
            buff[offset + 1] = incremental;

            buff[offset + 2] = (x >> 8) & 0xFF;
            buff[offset + 3] = x & 0xFF;

            buff[offset + 4] = (y >> 8) & 0xFF;
            buff[offset + 5] = y & 0xFF;

            buff[offset + 6] = (w >> 8) & 0xFF;
            buff[offset + 7] = w & 0xFF;

            buff[offset + 8] = (h >> 8) & 0xFF;
            buff[offset + 9] = h & 0xFF;

            sock._sQlen += 10;
        }
    };

    RFB.genDES = function (password, challenge) {
        var passwd = [];
        for (var i = 0; i < password.length; i++) {
            passwd.push(password.charCodeAt(i));
        }
        return (new DES(passwd)).encrypt(challenge);
    };

    RFB.extract_data_uri = function (arr) {
        return ";base64," + Base64.encode(arr);
    };

    RFB.encodingHandlers = {
        RAW: function () {
            if (this._FBU.lines === 0) {
                this._FBU.lines = this._FBU.height;
            }

            this._FBU.bytes = this._FBU.width * this._fb_Bpp;  // at least a line
            if (this._sock.rQwait("RAW", this._FBU.bytes)) { return false; }
            var cur_y = this._FBU.y + (this._FBU.height - this._FBU.lines);
            var curr_height = Math.min(this._FBU.lines,
                                       Math.floor(this._sock.rQlen() / (this._FBU.width * this._fb_Bpp)));
            this._display.blitImage(this._FBU.x, cur_y, this._FBU.width,
                                    curr_height, this._sock.get_rQ(),
                                    this._sock.get_rQi());
            this._sock.rQskipBytes(this._FBU.width * curr_height * this._fb_Bpp);
            this._FBU.lines -= curr_height;

            if (this._FBU.lines > 0) {
                this._FBU.bytes = this._FBU.width * this._fb_Bpp;  // At least another line
            } else {
                this._FBU.rects--;
                this._FBU.bytes = 0;
            }

            return true;
        },

        COPYRECT: function () {
            this._FBU.bytes = 4;
            if (this._sock.rQwait("COPYRECT", 4)) { return false; }
            this._display.copyImage(this._sock.rQshift16(), this._sock.rQshift16(),
                                    this._FBU.x, this._FBU.y, this._FBU.width,
                                    this._FBU.height);

            this._FBU.rects--;
            this._FBU.bytes = 0;
            return true;
        },

        RRE: function () {
            var color;
            if (this._FBU.subrects === 0) {
                this._FBU.bytes = 4 + this._fb_Bpp;
                if (this._sock.rQwait("RRE", 4 + this._fb_Bpp)) { return false; }
                this._FBU.subrects = this._sock.rQshift32();
                color = this._sock.rQshiftBytes(this._fb_Bpp);  // Background
                this._display.fillRect(this._FBU.x, this._FBU.y, this._FBU.width, this._FBU.height, color);
            }

            while (this._FBU.subrects > 0 && this._sock.rQlen() >= (this._fb_Bpp + 8)) {
                color = this._sock.rQshiftBytes(this._fb_Bpp);
                var x = this._sock.rQshift16();
                var y = this._sock.rQshift16();
                var width = this._sock.rQshift16();
                var height = this._sock.rQshift16();
                this._display.fillRect(this._FBU.x + x, this._FBU.y + y, width, height, color);
                this._FBU.subrects--;
            }

            if (this._FBU.subrects > 0) {
                var chunk = Math.min(this._rre_chunk_sz, this._FBU.subrects);
                this._FBU.bytes = (this._fb_Bpp + 8) * chunk;
            } else {
                this._FBU.rects--;
                this._FBU.bytes = 0;
            }

            return true;
        },

        HEXTILE: function () {
            var rQ = this._sock.get_rQ();
            var rQi = this._sock.get_rQi();

            if (this._FBU.tiles === 0) {
                this._FBU.tiles_x = Math.ceil(this._FBU.width / 16);
                this._FBU.tiles_y = Math.ceil(this._FBU.height / 16);
                this._FBU.total_tiles = this._FBU.tiles_x * this._FBU.tiles_y;
                this._FBU.tiles = this._FBU.total_tiles;
            }

            while (this._FBU.tiles > 0) {
                this._FBU.bytes = 1;
                if (this._sock.rQwait("HEXTILE subencoding", this._FBU.bytes)) { return false; }
                var subencoding = rQ[rQi];  // Peek
                if (subencoding > 30) {  // Raw
                    this._fail("Disconnected: illegal hextile subencoding " + subencoding);
                    return false;
                }

                var subrects = 0;
                var curr_tile = this._FBU.total_tiles - this._FBU.tiles;
                var tile_x = curr_tile % this._FBU.tiles_x;
                var tile_y = Math.floor(curr_tile / this._FBU.tiles_x);
                var x = this._FBU.x + tile_x * 16;
                var y = this._FBU.y + tile_y * 16;
                var w = Math.min(16, (this._FBU.x + this._FBU.width) - x);
                var h = Math.min(16, (this._FBU.y + this._FBU.height) - y);

                // Figure out how much we are expecting
                if (subencoding & 0x01) {  // Raw
                    this._FBU.bytes += w * h * this._fb_Bpp;
                } else {
                    if (subencoding & 0x02) {  // Background
                        this._FBU.bytes += this._fb_Bpp;
                    }
                    if (subencoding & 0x04) {  // Foreground
                        this._FBU.bytes += this._fb_Bpp;
                    }
                    if (subencoding & 0x08) {  // AnySubrects
                        this._FBU.bytes++;  // Since we aren't shifting it off
                        if (this._sock.rQwait("hextile subrects header", this._FBU.bytes)) { return false; }
                        subrects = rQ[rQi + this._FBU.bytes - 1];  // Peek
                        if (subencoding & 0x10) {  // SubrectsColoured
                            this._FBU.bytes += subrects * (this._fb_Bpp + 2);
                        } else {
                            this._FBU.bytes += subrects * 2;
                        }
                    }
                }

                if (this._sock.rQwait("hextile", this._FBU.bytes)) { return false; }

                // We know the encoding and have a whole tile
                this._FBU.subencoding = rQ[rQi];
                rQi++;
                if (this._FBU.subencoding === 0) {
                    if (this._FBU.lastsubencoding & 0x01) {
                        // Weird: ignore blanks are RAW
                        Util.Debug("     Ignoring blank after RAW");
                    } else {
                        this._display.fillRect(x, y, w, h, this._FBU.background);
                    }
                } else if (this._FBU.subencoding & 0x01) {  // Raw
                    this._display.blitImage(x, y, w, h, rQ, rQi);
                    rQi += this._FBU.bytes - 1;
                } else {
                    if (this._FBU.subencoding & 0x02) {  // Background
                        if (this._fb_Bpp == 1) {
                            this._FBU.background = rQ[rQi];
                        } else {
                            // fb_Bpp is 4
                            this._FBU.background = [rQ[rQi], rQ[rQi + 1], rQ[rQi + 2], rQ[rQi + 3]];
                        }
                        rQi += this._fb_Bpp;
                    }
                    if (this._FBU.subencoding & 0x04) {  // Foreground
                        if (this._fb_Bpp == 1) {
                            this._FBU.foreground = rQ[rQi];
                        } else {
                            // this._fb_Bpp is 4
                            this._FBU.foreground = [rQ[rQi], rQ[rQi + 1], rQ[rQi + 2], rQ[rQi + 3]];
                        }
                        rQi += this._fb_Bpp;
                    }

                    this._display.startTile(x, y, w, h, this._FBU.background);
                    if (this._FBU.subencoding & 0x08) {  // AnySubrects
                        subrects = rQ[rQi];
                        rQi++;

                        for (var s = 0; s < subrects; s++) {
                            var color;
                            if (this._FBU.subencoding & 0x10) {  // SubrectsColoured
                                if (this._fb_Bpp === 1) {
                                    color = rQ[rQi];
                                } else {
                                    // _fb_Bpp is 4
                                    color = [rQ[rQi], rQ[rQi + 1], rQ[rQi + 2], rQ[rQi + 3]];
                                }
                                rQi += this._fb_Bpp;
                            } else {
                                color = this._FBU.foreground;
                            }
                            var xy = rQ[rQi];
                            rQi++;
                            var sx = (xy >> 4);
                            var sy = (xy & 0x0f);

                            var wh = rQ[rQi];
                            rQi++;
                            var sw = (wh >> 4) + 1;
                            var sh = (wh & 0x0f) + 1;

                            this._display.subTile(sx, sy, sw, sh, color);
                        }
                    }
                    this._display.finishTile();
                }
                this._sock.set_rQi(rQi);
                this._FBU.lastsubencoding = this._FBU.subencoding;
                this._FBU.bytes = 0;
                this._FBU.tiles--;
            }

            if (this._FBU.tiles === 0) {
                this._FBU.rects--;
            }

            return true;
        },

        getTightCLength: function (arr) {
            var header = 1, data = 0;
            data += arr[0] & 0x7f;
            if (arr[0] & 0x80) {
                header++;
                data += (arr[1] & 0x7f) << 7;
                if (arr[1] & 0x80) {
                    header++;
                    data += arr[2] << 14;
                }
            }
            return [header, data];
        },

        display_tight: function (isTightPNG) {
            if (this._fb_depth === 1) {
                this._fail("Tight protocol handler only implements true color mode");
            }

            this._FBU.bytes = 1;  // compression-control byte
            if (this._sock.rQwait("TIGHT compression-control", this._FBU.bytes)) { return false; }

            var checksum = function (data) {
                var sum = 0;
                for (var i = 0; i < data.length; i++) {
                    sum += data[i];
                    if (sum > 65536) sum -= 65536;
                }
                return sum;
            };

            var resetStreams = 0;
            var streamId = -1;
            var decompress = function (data, expected) {
                for (var i = 0; i < 4; i++) {
                    if ((resetStreams >> i) & 1) {
                        this._FBU.zlibs[i].reset();
                        Util.Debug("Reset zlib stream " + i);
                        Util.Info("Reset zlib stream " + i);
                    }
                }

                //var uncompressed = this._FBU.zlibs[streamId].uncompress(data, 0);
                var uncompressed = this._FBU.zlibs[streamId].inflate(data, true, expected);
                /*if (uncompressed.status !== 0) {
                    Util.Error("Invalid data in zlib stream");
                }*/

                //return uncompressed.data;
                return uncompressed;
            }.bind(this);

            var indexedToRGBX2Color = function (data, palette, width, height) {
                // Convert indexed (palette based) image data to RGB
                // TODO: reduce number of calculations inside loop
                var dest = this._destBuff;
                var w = Math.floor((width + 7) / 8);
                var w1 = Math.floor(width / 8);

                /*for (var y = 0; y < height; y++) {
                    var b, x, dp, sp;
                    var yoffset = y * width;
                    var ybitoffset = y * w;
                    var xoffset, targetbyte;
                    for (x = 0; x < w1; x++) {
                        xoffset = yoffset + x * 8;
                        targetbyte = data[ybitoffset + x];
                        for (b = 7; b >= 0; b--) {
                            dp = (xoffset + 7 - b) * 3;
                            sp = (targetbyte >> b & 1) * 3;
                            dest[dp] = palette[sp];
                            dest[dp + 1] = palette[sp + 1];
                            dest[dp + 2] = palette[sp + 2];
                        }
                    }

                    xoffset = yoffset + x * 8;
                    targetbyte = data[ybitoffset + x];
                    for (b = 7; b >= 8 - width % 8; b--) {
                        dp = (xoffset + 7 - b) * 3;
                        sp = (targetbyte >> b & 1) * 3;
                        dest[dp] = palette[sp];
                        dest[dp + 1] = palette[sp + 1];
                        dest[dp + 2] = palette[sp + 2];
                    }
                }*/

                for (var y = 0; y < height; y++) {
                    var b, x, dp, sp;
                    for (x = 0; x < w1; x++) {
                        for (b = 7; b >= 0; b--) {
                            dp = (y * width + x * 8 + 7 - b) * 4;
                            sp = (data[y * w + x] >> b & 1) * 3;
                            dest[dp] = palette[sp];
                            dest[dp + 1] = palette[sp + 1];
                            dest[dp + 2] = palette[sp + 2];
                            dest[dp + 3] = 255;
                        }
                    }

                    for (b = 7; b >= 8 - width % 8; b--) {
                        dp = (y * width + x * 8 + 7 - b) * 4;
                        sp = (data[y * w + x] >> b & 1) * 3;
                        dest[dp] = palette[sp];
                        dest[dp + 1] = palette[sp + 1];
                        dest[dp + 2] = palette[sp + 2];
                        dest[dp + 3] = 255;
                    }
                }

                return dest;
            }.bind(this);

            var indexedToRGBX = function (data, palette, width, height) {
                // Convert indexed (palette based) image data to RGB
                var dest = this._destBuff;
                var total = width * height * 4;
                for (var i = 0, j = 0; i < total; i += 4, j++) {
                    var sp = data[j] * 3;
                    dest[i] = palette[sp];
                    dest[i + 1] = palette[sp + 1];
                    dest[i + 2] = palette[sp + 2];
                    dest[i + 3] = 255;
                }

                return dest;
            }.bind(this);

            var rQi = this._sock.get_rQi();
            var rQ = this._sock.rQwhole();
            var cmode, data;
            var cl_header, cl_data;

            var handlePalette = function () {
                var numColors = rQ[rQi + 2] + 1;
                var paletteSize = numColors * this._fb_depth;
                this._FBU.bytes += paletteSize;
                if (this._sock.rQwait("TIGHT palette " + cmode, this._FBU.bytes)) { return false; }

                var bpp = (numColors <= 2) ? 1 : 8;
                var rowSize = Math.floor((this._FBU.width * bpp + 7) / 8);
                var raw = false;
                if (rowSize * this._FBU.height < 12) {
                    raw = true;
                    cl_header = 0;
                    cl_data = rowSize * this._FBU.height;
                    //clength = [0, rowSize * this._FBU.height];
                } else {
                    // begin inline getTightCLength (returning two-item arrays is bad for performance with GC)
                    var cl_offset = rQi + 3 + paletteSize;
                    cl_header = 1;
                    cl_data = 0;
                    cl_data += rQ[cl_offset] & 0x7f;
                    if (rQ[cl_offset] & 0x80) {
                        cl_header++;
                        cl_data += (rQ[cl_offset + 1] & 0x7f) << 7;
                        if (rQ[cl_offset + 1] & 0x80) {
                            cl_header++;
                            cl_data += rQ[cl_offset + 2] << 14;
                        }
                    }
                    // end inline getTightCLength
                }

                this._FBU.bytes += cl_header + cl_data;
                if (this._sock.rQwait("TIGHT " + cmode, this._FBU.bytes)) { return false; }

                // Shift ctl, filter id, num colors, palette entries, and clength off
                this._sock.rQskipBytes(3);
                //var palette = this._sock.rQshiftBytes(paletteSize);
                this._sock.rQshiftTo(this._paletteBuff, paletteSize);
                this._sock.rQskipBytes(cl_header);

                if (raw) {
                    data = this._sock.rQshiftBytes(cl_data);
                } else {
                    data = decompress(this._sock.rQshiftBytes(cl_data), rowSize * this._FBU.height);
                }

                // Convert indexed (palette based) image data to RGB
                var rgbx;
                if (numColors == 2) {
                    rgbx = indexedToRGBX2Color(data, this._paletteBuff, this._FBU.width, this._FBU.height);
                    this._display.blitRgbxImage(this._FBU.x, this._FBU.y, this._FBU.width, this._FBU.height, rgbx, 0, false);
                } else {
                    rgbx = indexedToRGBX(data, this._paletteBuff, this._FBU.width, this._FBU.height);
                    this._display.blitRgbxImage(this._FBU.x, this._FBU.y, this._FBU.width, this._FBU.height, rgbx, 0, false);
                }


                return true;
            }.bind(this);

            var handleCopy = function () {
                var raw = false;
                var uncompressedSize = this._FBU.width * this._FBU.height * this._fb_depth;
                if (uncompressedSize < 12) {
                    raw = true;
                    cl_header = 0;
                    cl_data = uncompressedSize;
                } else {
                    // begin inline getTightCLength (returning two-item arrays is for peformance with GC)
                    var cl_offset = rQi + 1;
                    cl_header = 1;
                    cl_data = 0;
                    cl_data += rQ[cl_offset] & 0x7f;
                    if (rQ[cl_offset] & 0x80) {
                        cl_header++;
                        cl_data += (rQ[cl_offset + 1] & 0x7f) << 7;
                        if (rQ[cl_offset + 1] & 0x80) {
                            cl_header++;
                            cl_data += rQ[cl_offset + 2] << 14;
                        }
                    }
                    // end inline getTightCLength
                }
                this._FBU.bytes = 1 + cl_header + cl_data;
                if (this._sock.rQwait("TIGHT " + cmode, this._FBU.bytes)) { return false; }

                // Shift ctl, clength off
                this._sock.rQshiftBytes(1 + cl_header);

                if (raw) {
                    data = this._sock.rQshiftBytes(cl_data);
                } else {
                    data = decompress(this._sock.rQshiftBytes(cl_data), uncompressedSize);
                }

                this._display.blitRgbImage(this._FBU.x, this._FBU.y, this._FBU.width, this._FBU.height, data, 0, false);

                return true;
            }.bind(this);

            var ctl = this._sock.rQpeek8();

            // Keep tight reset bits
            resetStreams = ctl & 0xF;

            // Figure out filter
            ctl = ctl >> 4;
            streamId = ctl & 0x3;

            if (ctl === 0x08)       cmode = "fill";
            else if (ctl === 0x09)  cmode = "jpeg";
            else if (ctl === 0x0A)  cmode = "png";
            else if (ctl & 0x04)    cmode = "filter";
            else if (ctl < 0x04)    cmode = "copy";
            else return this._fail("Illegal tight compression received, ctl: " + ctl);

            if (isTightPNG && (cmode === "filter" || cmode === "copy")) {
                return this._fail("filter/copy received in tightPNG mode");
            }

            switch (cmode) {
                // fill use fb_depth because TPIXELs drop the padding byte
                case "fill":  // TPIXEL
                    this._FBU.bytes += this._fb_depth;
                    break;
                case "jpeg":  // max clength
                    this._FBU.bytes += 3;
                    break;
                case "png":  // max clength
                    this._FBU.bytes += 3;
                    break;
                case "filter":  // filter id + num colors if palette
                    this._FBU.bytes += 2;
                    break;
                case "copy":
                    break;
            }

            if (this._sock.rQwait("TIGHT " + cmode, this._FBU.bytes)) { return false; }

            // Determine FBU.bytes
            switch (cmode) {
                case "fill":
                    // skip ctl byte
                    this._display.fillRect(this._FBU.x, this._FBU.y, this._FBU.width, this._FBU.height, [rQ[rQi + 3], rQ[rQi + 2], rQ[rQi + 1]], false);
                    this._sock.rQskipBytes(4);
                    break;
                case "png":
                case "jpeg":
                    // begin inline getTightCLength (returning two-item arrays is for peformance with GC)
                    var cl_offset = rQi + 1;
                    cl_header = 1;
                    cl_data = 0;
                    cl_data += rQ[cl_offset] & 0x7f;
                    if (rQ[cl_offset] & 0x80) {
                        cl_header++;
                        cl_data += (rQ[cl_offset + 1] & 0x7f) << 7;
                        if (rQ[cl_offset + 1] & 0x80) {
                            cl_header++;
                            cl_data += rQ[cl_offset + 2] << 14;
                        }
                    }
                    // end inline getTightCLength
                    this._FBU.bytes = 1 + cl_header + cl_data;  // ctl + clength size + jpeg-data
                    if (this._sock.rQwait("TIGHT " + cmode, this._FBU.bytes)) { return false; }

                    // We have everything, render it
                    this._sock.rQskipBytes(1 + cl_header);  // shift off clt + compact length
                    var img = new Image();
                    img.src = "data:image/" + cmode +
                        RFB.extract_data_uri(this._sock.rQshiftBytes(cl_data));
                    this._display.renderQ_push({
                        'type': 'img',
                        'img': img,
                        'x': this._FBU.x,
                        'y': this._FBU.y
                    });
                    img = null;
                    break;
                case "filter":
                    var filterId = rQ[rQi + 1];
                    if (filterId === 1) {
                        if (!handlePalette()) { return false; }
                    } else {
                        // Filter 0, Copy could be valid here, but servers don't send it as an explicit filter
                        // Filter 2, Gradient is valid but not use if jpeg is enabled
                        this._fail("Unsupported tight subencoding received, filter: " + filterId);
                    }
                    break;
                case "copy":
                    if (!handleCopy()) { return false; }
                    break;
            }


            this._FBU.bytes = 0;
            this._FBU.rects--;

            return true;
        },

        TIGHT: function () { return this._encHandlers.display_tight(false); },
        TIGHT_PNG: function () { return this._encHandlers.display_tight(true); },

        last_rect: function () {
            this._FBU.rects = 0;
            return true;
        },

        handle_FB_resize: function () {
            this._fb_width = this._FBU.width;
            this._fb_height = this._FBU.height;
            this._destBuff = new Uint8Array(this._fb_width * this._fb_height * 4);
            this._display.resize(this._fb_width, this._fb_height);
            this._onFBResize(this, this._fb_width, this._fb_height);
            this._timing.fbu_rt_start = (new Date()).getTime();

            this._FBU.bytes = 0;
            this._FBU.rects -= 1;
            return true;
        },

        ExtendedDesktopSize: function () {
            this._FBU.bytes = 1;
            if (this._sock.rQwait("ExtendedDesktopSize", this._FBU.bytes)) { return false; }

            this._supportsSetDesktopSize = true;
            var number_of_screens = this._sock.rQpeek8();

            this._FBU.bytes = 4 + (number_of_screens * 16);
            if (this._sock.rQwait("ExtendedDesktopSize", this._FBU.bytes)) { return false; }

            this._sock.rQskipBytes(1);  // number-of-screens
            this._sock.rQskipBytes(3);  // padding

            for (var i = 0; i < number_of_screens; i += 1) {
                // Save the id and flags of the first screen
                if (i === 0) {
                    this._screen_id = this._sock.rQshiftBytes(4);    // id
                    this._sock.rQskipBytes(2);                       // x-position
                    this._sock.rQskipBytes(2);                       // y-position
                    this._sock.rQskipBytes(2);                       // width
                    this._sock.rQskipBytes(2);                       // height
                    this._screen_flags = this._sock.rQshiftBytes(4); // flags
                } else {
                    this._sock.rQskipBytes(16);
                }
            }

            /*
             * The x-position indicates the reason for the change:
             *
             *  0 - server resized on its own
             *  1 - this client requested the resize
             *  2 - another client requested the resize
             */

            // We need to handle errors when we requested the resize.
            if (this._FBU.x === 1 && this._FBU.y !== 0) {
                var msg = "";
                // The y-position indicates the status code from the server
                switch (this._FBU.y) {
                case 1:
                    msg = "Resize is administratively prohibited";
                    break;
                case 2:
                    msg = "Out of resources";
                    break;
                case 3:
                    msg = "Invalid screen layout";
                    break;
                default:
                    msg = "Unknown reason";
                    break;
                }
                Util.Info("Server did not accept the resize request: " + msg);
                return true;
            }

            this._encHandlers.handle_FB_resize();
            return true;
        },

        DesktopSize: function () {
            this._encHandlers.handle_FB_resize();
            return true;
        },

        Cursor: function () {
            Util.Debug(">> set_cursor");
            var x = this._FBU.x;  // hotspot-x
            var y = this._FBU.y;  // hotspot-y
            var w = this._FBU.width;
            var h = this._FBU.height;

            var pixelslength = w * h * this._fb_Bpp;
            var masklength = Math.floor((w + 7) / 8) * h;

            this._FBU.bytes = pixelslength + masklength;
            if (this._sock.rQwait("cursor encoding", this._FBU.bytes)) { return false; }

            this._display.changeCursor(this._sock.rQshiftBytes(pixelslength),
                                       this._sock.rQshiftBytes(masklength),
                                       x, y, w, h);

            this._FBU.bytes = 0;
            this._FBU.rects--;

            Util.Debug("<< set_cursor");
            return true;
        },

        JPEG_quality_lo: function () {
            Util.Error("Server sent jpeg_quality pseudo-encoding");
        },

        compress_lo: function () {
            Util.Error("Server sent compress level pseudo-encoding");
        }
    };
})();
