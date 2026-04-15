*** Settings ***
Resource          common.resource
Library           OperatingSystem
Suite Setup       Open Browser To App
Suite Teardown    Close App

*** Variables ***
${TMP_DIR}              /tmp
${TEST_FILE_CONTENT}    Hello from SnowShare E2E tests

*** Keywords ***
Create Temp File
    [Documentation]    Write a small temp file and return its absolute path
    [Arguments]    ${filename}    ${content}=${TEST_FILE_CONTENT}
    ${path}=    Set Variable    ${TMP_DIR}/${filename}
    Create File    ${path}    ${content}
    RETURN    ${path}

Go To FileShare Tab
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Click              text=FileShare
    Wait For Elements State    text="Select Files"    visible

*** Test Cases ***
FileShare Tab Is Visible
    [Documentation]    Verify the FileShare tab is accessible on the home page
    Go To              ${BASE_URL}
    Wait For Load State    networkidle
    Wait For Elements State    text="FileShare"    visible
    Click              text=FileShare
    # The dropzone with "Select Files" button should appear
    Wait For Elements State    text="Select Files"    visible

Anonymous User Can Upload A File
    [Documentation]    Verify that an anonymous user can upload a small file and get a share link
    Go To FileShare Tab

    ${file_path}=    Create Temp File    e2e_test_anon.txt
    Upload File By Selector    css=input[type="file"]:not([webkitdirectory])    ${file_path}

    # After file selection the dropzone should show the selected file name
    Wait For Elements State    text="e2e_test_anon.txt"    visible    timeout=5s

    # Submit the upload
    Click        button[type="submit"]

    # Wait for the tus upload to complete and the success banner to appear
    Share Was Created
    Wait For Elements State    css=div[role="status"] a    visible    timeout=30s

Created File Share URL Starts With Base URL
    [Documentation]    Verify the share URL in the success banner belongs to this instance
    Go To FileShare Tab

    ${file_path}=    Create Temp File    e2e_test_url.txt
    Upload File By Selector    css=input[type="file"]:not([webkitdirectory])    ${file_path}

    Wait For Elements State    text="e2e_test_url.txt"    visible    timeout=5s
    Click        button[type="submit"]
    Share Was Created

    ${share_url}=    Get Attribute    css=div[role="status"] a    href
    Should Start With    ${share_url}    ${BASE_URL}/f/

File Share Page Is Accessible After Upload
    [Documentation]    Verify the file share page loads correctly after navigating to the share URL
    Go To FileShare Tab

    ${file_path}=    Create Temp File    e2e_test_page.txt
    Upload File By Selector    css=input[type="file"]:not([webkitdirectory])    ${file_path}

    Wait For Elements State    text="e2e_test_page.txt"    visible    timeout=5s
    Click        button[type="submit"]
    Share Was Created

    ${share_url}=    Get Attribute    css=div[role="status"] a    href
    Go To    ${share_url}
    Wait For Load State    networkidle

    # The file share page should show the filename and a download button
    Wait For Elements State    text="e2e_test_page.txt"    visible    timeout=10s

File Share With Password Is Protected
    [Documentation]    Verify that a password-protected file share shows a password form on its page
    Go To FileShare Tab

    ${file_path}=    Create Temp File    e2e_test_protected.txt
    Upload File By Selector    css=input[type="file"]:not([webkitdirectory])    ${file_path}

    Wait For Elements State    text="e2e_test_protected.txt"    visible    timeout=5s

    # Fill the password field in the Advanced settings panel
    Wait For Elements State    input[type="password"]    visible    timeout=5s
    Fill Text    input[type="password"]    filepassword

    Click        button[type="submit"]
    Share Was Created

    ${share_url}=    Get Attribute    css=div[role="status"] a    href
    Go To    ${share_url}
    Wait For Load State    networkidle

    # Unlike link shares, file shares show the password form directly on /f/[slug] (no /private redirect)
    Wait For Elements State    input[name="password"]    visible    timeout=10s

Authenticated User Can Upload A File That Never Expires
    [Documentation]    Verify that a logged-in user can upload a file with no expiry date
    Login As Admin
    Go To FileShare Tab

    ${file_path}=    Create Temp File    e2e_test_auth.txt
    Upload File By Selector    css=input[type="file"]:not([webkitdirectory])    ${file_path}

    Wait For Elements State    text="e2e_test_auth.txt"    visible    timeout=5s

    # Toggle "No expiration"
    ${toggle_visible}=    Run Keyword And Return Status
    ...    Wait For Elements State    text="No expiration"    visible    timeout=3s
    IF    ${toggle_visible}
        Click    text="No expiration"
    END

    Click        button[type="submit"]
    Share Was Created

    Logout
