#!/usr/bin/env bash

Xvfb $DISPLAY -ac -screen 0 $VNC_RESOLUTION'x24' -nolisten unix
# Xvfb $DISPLAY -screen 0 $VNC_RESOLUTION'x24' -nolisten unix
