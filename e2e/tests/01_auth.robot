*** Settings ***
Resource          common.resource
Suite Setup       Open Browser To App
Suite Teardown    Close App

*** Test Cases ***
Home Page Contains Share Options
    [Documentation]    Verify the main tabs are present on the home page without being logged in
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Wait For Elements State    text="LinkShare"    visible
    Wait For Elements State    text="PasteShare"   visible
    Wait For Elements State    text="FileShare"    visible

Login Page Is Accessible
    [Documentation]    Verify the sign-in page loads and contains email/password fields
    Go To              ${BASE_URL}/auth/signin
    Wait For Load State    networkidle
    Wait For Elements State    input[name="email"]       visible
    Wait For Elements State    input[name="password"]    visible
    Wait For Elements State    button[type="submit"]     visible

Admin Can Login And Logout
    [Documentation]    Verify the admin account can sign in and sign out successfully
    Login As Admin
    # After login, the "Sign in" link should be gone
    Wait For Elements State    text="Sign in"    hidden    timeout=5s
    Logout
    # After logout, the "Sign in" link should be visible again
    Wait For Elements State    text="Sign in"    visible    timeout=5s

Login With Wrong Password Shows Error
    [Documentation]    Verify that incorrect credentials display an error message
    Go To              ${BASE_URL}/auth/signin
    Wait For Load State    networkidle
    Fill Text    input[name="email"]      ${ADMIN_EMAIL}
    Fill Text    input[name="password"]   wrongpassword
    Click        button[type="submit"]
    Wait For Load State    networkidle
    # An error message with red text should appear
    Wait For Elements State    css=.text-red-400    visible    timeout=5s

Signup Page Is Accessible
    [Documentation]    Verify the registration page loads and contains the required fields
    Go To              ${BASE_URL}/auth/signup
    Wait For Load State    networkidle
    Wait For Elements State    input[name="email"]              visible
    Wait For Elements State    input[name="password"]           visible
    Wait For Elements State    input[name="confirm-password"]   visible
    Wait For Elements State    button[type="submit"]            visible
