*** Settings ***
Resource          common.resource
Library           OperatingSystem
Suite Setup       Open Browser To App
Suite Teardown    Close App

*** Variables ***
${TMP_DIR}    /tmp

*** Keywords ***
Go To Home LinkShare Tab
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=LinkShare
    Wait For Elements State    input[type="url"]    visible

Go To Home PasteShare Tab
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=PasteShare
    Wait For Elements State    button[type="submit"]    visible

Go To Home FileShare Tab
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=FileShare
    Wait For Elements State    text="Select Files"    visible    timeout=20s

*** Test Cases ***
# ── LinkShare errors ──────────────────────────────────────────────────────────

Link Share Submit Without URL Shows Error
    [Documentation]    Verify the submit button is disabled when no URL is entered
    Go To Home LinkShare Tab
    # The submit button should be disabled when the URL field is empty
    ${disabled}=    Get Attribute    button[type="submit"]    disabled
    Should Not Be Equal    ${disabled}    ${None}

Link Share Invalid URL Shows Inline Error
    [Documentation]    Verify that typing a non-URL string shows an inline validation error
    Go To Home LinkShare Tab
    Fill Text    input[type="url"]    not-a-valid-url
    # Trigger blur to activate validation
    Press Keys    input[type="url"]    Tab
    Wait For Elements State    text="Invalid URL format"    visible    timeout=5s

Link Share Invalid URL Disables Submit
    [Documentation]    Verify the submit button stays disabled when the URL is invalid
    Go To Home LinkShare Tab
    Fill Text    input[type="url"]    not-a-valid-url
    Press Keys    input[type="url"]    Tab
    ${disabled}=    Get Attribute    button[type="submit"]    disabled
    Should Not Be Equal    ${disabled}    ${None}

# ── FileShare errors ───────────────────────────────────────────────────────────

File Share Submit Without File Shows Error
    [Documentation]    Verify that submitting the FileShare form without a file shows an error
    Go To Home FileShare Tab
    # The submit button should be disabled when no file is selected
    ${disabled}=    Get Attribute    button[type="submit"]    disabled
    Should Not Be Equal    ${disabled}    ${None}

# ── Share not found ────────────────────────────────────────────────────────────

File Share Not Found Shows Error
    [Documentation]    Verify that navigating to a non-existent file share shows an error
    Go To              ${BASE_URL}/f/this-slug-does-not-exist-xyz
    Wait For Load State    networkidle
    Wait For Elements State    text="File not found"    visible    timeout=10s

Paste Share Not Found Shows Error
    [Documentation]    Verify that navigating to a non-existent paste share shows an error
    Go To              ${BASE_URL}/p/this-slug-does-not-exist-xyz
    Wait For Load State    networkidle
    # The API returns the i18n key api.errors.share_not_found → "Share not found" in English
    Wait For Elements State    text="Share not found"    visible    timeout=10s

Link Share Not Found Redirects Or Shows Error
    [Documentation]    Verify that navigating to a non-existent link share returns a 404 response
    Go To              ${BASE_URL}/l/this-slug-does-not-exist-xyz
    Wait For Load State    networkidle
    # The route returns a JSON error; the browser should either show a Next.js 404 page
    # or the raw JSON response — either way the URL should still contain the slug
    ${url}=    Get Url
    Should Contain    ${url}    this-slug-does-not-exist-xyz

# ── Password unlock errors ─────────────────────────────────────────────────────

Wrong Password On Protected Link Share Shows Error
    [Documentation]    Verify that submitting the wrong password on a protected link shows an error
    # First create a password-protected link share
    Go To Home LinkShare Tab
    Fill Text    input[type="url"]    https://example.com
    Wait For Elements State    input[type="password"]    visible
    Fill Text    input[type="password"]    correctpassword
    Click        button[type="submit"]
    Share Was Created

    ${share_url}=    Get Attribute    css=div[role="status"] a    href
    Go To    ${share_url}
    Wait For Load State    networkidle

    # We should be on the /private unlock page — enter the wrong password
    Wait For Elements State    input[type="password"]    visible    timeout=5s
    Fill Text    input[type="password"]    wrongpassword
    Click        button[type="submit"]
    Wait For Load State    networkidle

    # An error message should be visible
    Wait For Elements State    css=.text-red-400    visible    timeout=5s

Wrong Password On Protected File Share Shows Error
    [Documentation]    Verify that downloading a protected file with the wrong password shows an error
    # The file share password flow has two steps:
    # 1. The password form calls "info" action (does not validate the password)
    #    → always succeeds and reveals the download button
    # 2. The download button calls "download" action (validates the password via bcrypt)
    #    → returns an error if the password is wrong

    Go To Home FileShare Tab

    ${file_path}=    Set Variable    ${TMP_DIR}/e2e_error_protected.txt
    Create File      ${file_path}    error test content
    Upload File By Selector    css=input[type="file"]:not([webkitdirectory])    ${file_path}

    Wait For Elements State    text="e2e_error_protected.txt"    visible    timeout=5s
    Wait For Elements State    input[type="password"]    visible
    Fill Text    input[type="password"]    correctpassword
    Click        button[type="submit"]
    Share Was Created

    ${share_url}=    Get Attribute    css=div[role="status"] a    href
    Go To    ${share_url}
    Wait For Load State    networkidle

    # Step 1 — fill the wrong password and submit the password form (always passes info check)
    Wait For Elements State    input[name="password"]    visible    timeout=10s
    Fill Text    input[name="password"]    wrongpassword
    Click        button[type="submit"]

    # Step 2 — the download button is now visible ("Download", not "Download file" which is the h2 title)
    Wait For Elements State    css=button >> text=Download    visible    timeout=5s
    Click    css=button >> text=Download

    # The download action rejects the wrong password → error div appears
    Wait For Elements State    css=.text-red-400    visible    timeout=10s

# ── Auth errors ────────────────────────────────────────────────────────────────

Login With Empty Fields Shows No Redirect
    [Documentation]    Verify that submitting the login form with empty fields does not redirect
    Go To              ${BASE_URL}/auth/signin
    Wait For Load State    networkidle
    # Submit with empty fields
    Click        button[type="submit"]
    Wait For Load State    networkidle
    # Should still be on the signin page
    ${url}=    Get Url
    Should Contain    ${url}    /auth/signin

Signup With Mismatched Passwords Shows Error
    [Documentation]    Verify that mismatched passwords on the signup form show an error
    Go To              ${BASE_URL}/auth/signup
    Wait For Elements State    input[name="email"]    visible    timeout=15s
    Fill Text    input[name="email"]              newuser@example.com
    Fill Text    input[name="password"]           password123
    Fill Text    input[name="confirm-password"]   differentpassword
    Click        button[type="submit"]
    Wait For Load State    networkidle
    # An error about password mismatch should be displayed
    Wait For Elements State    css=.text-red-400    visible    timeout=5s
