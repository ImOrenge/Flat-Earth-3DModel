from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        page.goto('http://localhost:8000/')
        
        # Turn off reality sync using force to bypass the visual span overlay
        page.locator('#reality-sync').uncheck(force=True)
        
        # Set date
        page.locator('#observation-time').evaluate("node => { node.value = '2024-04-08T18:15'; node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); }")
        
        # Apply date
        page.locator('#apply-observation-time').click()
        
        # Wait a bit
        time.sleep(5)
        
        state = page.locator('#solar-eclipse-state').text_content()
        coverage = page.locator('#solar-eclipse-coverage').text_content()
        
        print("ECLIPSE STATE:", state)
        print("COVERAGE:", coverage)
        
        b.close()

if __name__ == '__main__':
    run()
