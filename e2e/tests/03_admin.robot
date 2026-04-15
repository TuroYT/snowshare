*** Settings ***
Resource          common.resource
Suite Setup       Setup Admin Suite
Suite Teardown    Close App

*** Keywords ***
Setup Admin Suite
    Open Browser To App
    Login As Admin

*** Test Cases ***
Admin Panel Is Accessible
    [Documentation]    Verify that the admin user can access the administration dashboard
    Go To              ${BASE_URL}/admin
    Wait For Load State    networkidle
    # The h1 heading on the admin page
    Wait For Elements State    css=h1    visible    timeout=10s
    Get Text    css=h1    *=    Administration Dashboard

Admin Panel Shows All Tabs
    [Documentation]    Verify that all main admin tabs are present
    Go To              ${BASE_URL}/admin
    Wait For Load State    networkidle
    Wait For Elements State    text="Users"        visible    timeout=10s
    Wait For Elements State    text="Settings"     visible
    Wait For Elements State    text="Branding"     visible
    Wait For Elements State    text="Share Logs"   visible
    Wait For Elements State    text="OAuth / SSO"  visible

Admin Users Tab Shows Admin User
    [Documentation]    Verify that the Users tab lists the admin account
    Go To              ${BASE_URL}/admin
    Wait For Load State    networkidle
    # Click the Users tab
    Wait For Elements State    text="Users"    visible    timeout=10s
    Click    text="Users"
    Wait For Load State    networkidle
    # The admin email should appear in the users list
    Wait For Elements State    text="${ADMIN_EMAIL}"    visible    timeout=10s

Non Admin User Is Denied Access To Admin Panel
    [Documentation]    Verify that an unauthenticated user cannot access the admin panel
    # Log out the admin first
    Logout
    # Attempt to access the admin page directly
    Go To              ${BASE_URL}/admin
    Wait For Load State    networkidle
    ${current_url}=    Get Url
    # Should be redirected to signin OR show "Access Denied" on the admin page
    ${redirected}=    Evaluate    "/auth/signin" in """${current_url}"""
    IF    ${redirected}
        Wait For Elements State    input[name="email"]    visible    timeout=5s
    ELSE
        Wait For Elements State    text="Access Denied"   visible    timeout=5s
    END
    # Restore admin session for any further tests
    Login As Admin
