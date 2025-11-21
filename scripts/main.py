import time
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from loguru import logger

options = Options()
options.add_experimental_option('debuggerAddress', "localhost:9222")

logger.info("before init driver")
driver = webdriver.Chrome(options=options)
logger.info("after init driver")
driver.get("https://ping.pe")
logger.info("sleep 300")
time.sleep(300)
