from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        
        errors = []
        page.on("pageerror", lambda e: errors.append(f"PageError: {e}"))
        page.on("console", lambda msg: errors.append(f"ConsoleError: {msg.text}") if msg.type == "error" else None)
        
        page.goto("http://localhost:8000/")
        page.wait_for_load_state("networkidle")
        
        for e in errors:
            print(f"ERROR: {e}")
            
        b.close()

if __name__ == "__main__":
    run()
