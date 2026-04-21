*** Settings ***
Library    Browser
Library    FakerLibrary

*** Variables ***
${BASE_URL}          http://localhost:3001
${BROWSER}           chromium
${HEADLESS}          True
${ADMIN_EMAIL}       admin@snowshare.local
${ADMIN_PASSWORD}    testpassword123

*** Keywords ***
Open Browser To App
    New Browser    browser=${BROWSER}    headless=${HEADLESS}
    New Context    viewport={'width': 1280, 'height': 720}    locale=en-US
    New Page       ${BASE_URL}
    Wait For Load State    networkidle

    ${url}=    Get Url
    IF    "/setup" in """${url}"""
        Complete Setup    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}
    END

    Wait For Elements State    text="LinkShare"    visible    timeout=20s

Complete Setup
    [Arguments]    ${email}    ${password}
    Fill Text    input[name="email"]              ${email}
    Fill Text    input[name="password"]           ${password}
    Fill Text    input[name="confirm-password"]   ${password}
    Click        button[type="submit"]
    Wait For Load State    networkidle
    Go To        ${BASE_URL}
    Wait For Load State    networkidle

Close App
    Close Browser

Login As
    [Arguments]    ${email}    ${password}
    Go To              ${BASE_URL}/auth/signin
    Wait For Elements State    input[name="email"]    visible    timeout=15s
    Fill Text    input[name="email"]      ${email}
    Fill Text    input[name="password"]   ${password}
    Click        button[type="submit"]
    Wait For URL    ${BASE_URL}/    timeout=15s
    Wait For Load State    networkidle
    Wait For Elements State    text="LinkShare"    visible    timeout=15s

Login As Admin
    Login As    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}

Logout
    # Click the MUI Avatar button (profile icon in the top-right navigation)
    Click    xpath=//button[.//*[contains(@class,'MuiAvatar-root')]]
    Wait For Elements State    text="Sign out"    visible    timeout=5s
    Click    text="Sign out"
    Wait For Load State    networkidle

Share Was Created
    [Documentation]    Verify the success banner is visible after share creation
    Wait For Elements State    css=div[role="status"]    visible    timeout=10s

Go To Share URL
    [Documentation]    Return the href of the link in the success banner
    ${link}=    Get Attribute    css=div[role="status"] a    href
    RETURN    ${link}
