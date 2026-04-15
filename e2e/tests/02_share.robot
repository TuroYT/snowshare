*** Settings ***
Resource          common.resource
Suite Setup       Open Browser To App
Suite Teardown    Close App

*** Test Cases ***
Create A Link Share
    [Documentation]    Verify that an anonymous user can create a link share
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=LinkShare
    Wait For Elements State    input[type="url"]    visible

    Fill Text    input[type="url"]    https://example.com
    Click        button[type="submit"]

    Share Was Created
    # The success banner should contain a clickable share link
    Wait For Elements State    css=div[role="status"] a    visible

Create A Paste Share
    [Documentation]    Verify that an anonymous user can create a paste share with default content
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=PasteShare

    # The form already contains default JavaScript code; submit as-is
    Wait For Elements State    button[type="submit"]    visible
    Click        button[type="submit"]

    Share Was Created
    Wait For Elements State    css=div[role="status"] a    visible

Created Link Share URL Starts With Base URL
    [Documentation]    Verify that the URL returned in the success banner belongs to this instance
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=LinkShare
    Wait For Elements State    input[type="url"]    visible

    Fill Text    input[type="url"]    https://example.com
    Click        button[type="submit"]

    Share Was Created
    ${share_url}=    Get Attribute    css=div[role="status"] a    href
    Should Start With    ${share_url}    ${BASE_URL}

Authenticated User Can Create A Link Share That Never Expires
    [Documentation]    Verify that a logged-in user can create a link share with no expiry
    Login As Admin

    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=LinkShare
    Wait For Elements State    input[type="url"]    visible

    Fill Text    input[type="url"]    https://robot-framework.org

    # Toggle the "No expiration" option (it's a custom CSS toggle, not a native checkbox)
    ${toggle_visible}=    Run Keyword And Return Status
    ...    Wait For Elements State    text="No expiration"    visible    timeout=3s
    IF    ${toggle_visible}
        Click    text="No expiration"
    END

    Click    button[type="submit"]

    Share Was Created

    Logout

Link Share With Password Is Protected
    [Documentation]    Verify that a password-protected link share redirects to the unlock page
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=LinkShare
    Wait For Elements State    input[type="url"]    visible

    Fill Text    input[type="url"]    https://example.com

    # The Advanced settings panel is always visible — fill the password field directly
    Wait For Elements State    input[type="password"]    visible    timeout=5s
    Fill Text    input[type="password"]    secretpassword

    Click    button[type="submit"]

    Share Was Created
    ${share_url}=    Get Attribute    css=div[role="status"] a    href

    # Navigate to the share — should redirect to the /private unlock page
    Go To    ${share_url}
    Wait For Load State    networkidle
    ${current_url}=    Get Url
    Should Contain    ${current_url}    /private
