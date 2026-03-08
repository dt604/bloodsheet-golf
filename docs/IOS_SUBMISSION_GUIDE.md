# 🩸 BloodSheet Golf — iOS Submission Guide (Codemagic & App Store) 🚀

Congratulations on joining the Apple Developer Program! With that in place, we can fully automate your iOS App Store submissions using **Codemagic**.

I've just updated your `codemagic.yaml` file to use **Automatic Code Signing**. This means Codemagic will automatically pull your developer certificates, configure your app, build it, and push it directly to TestFlight on Apple's servers.

Here are the exact, fresh steps to connect everything:

---

## 🏗 STEP 1: Generate your App Store Connect API Key
Apple requires a secure key so Codemagic can publish the app for you.

1.  Log in to [App Store Connect](https://appstoreconnect.apple.com/).
2.  Click the **Users and Access** icon.
3.  Choose the **Integrations** tab at the top.
4.  Under the "App Store Connect API" section, click the **(+)** button to generate a new key.
    *   **Name**: `Codemagic CI`
    *   **Access**: `App Manager` or `Admin`
5.  Click **Generate**.
6.  You will see your new key in the list. Note the **Issuer ID** (at the top) and the **Key ID**.
7.  Click **Download API Key** to get the `.p8` file. **(Keep this safe; Apple only lets you download it once!)**

---

## 🏗 STEP 2: Connect Apple to Codemagic
Now we tell Codemagic about that key so it can sign your app automatically.

1.  Log in to [Codemagic](https://codemagic.io/).
2.  In the left sidebar (at the very bottom), click **Team settings** (or personal Account Settings).
3.  Go to **Integrations** -> **Developer Portal** (Apple).
4.  Click **Manage keys** and then **Add key**.
5.  Enter `BloodSheet Store Key` for the name.
6.  Input the **Issuer ID** and **Key ID** you noted earlier.
7.  **Upload the `.p8` file** you downloaded.
8.  Click **Save**.

---

## 🏗 STEP 3: Create the App in App Store Connect
Before Codemagic can upload the app, Apple's servers need to know the app exists.

1.  Go back to the main [App Store Connect](https://appstoreconnect.apple.com/) dashboard.
2.  Click **My Apps**.
3.  Click the blue **(+)** button and select **New App**.
    *   **Platforms**: Check iOS.
    *   **Name**: BloodSheet Golf (or similar).
    *   **Primary Language**: English (US).
    *   **Bundle ID**: Select `com.bloodsheet.golf` from the dropdown (Codemagic will actually register this ID for you on the first build if it's not there, but check just in case).
    *   **SKU**: `BLOODSHEET_GOLF_01` (can be anything unique).
    *   **User Access**: Full Access.
4. Click **Create**.

---

## 🏗 STEP 4: Start the Cloud Build
1.  In Codemagic, go to your **Apps** list and select `bloodsheet-golf`.
2.  Because your project has a `codemagic.yaml` file, Codemagic will automatically detect the "BloodSheet Golf iOS Release" workflow.
3.  Click **Start new build**.
4.  Select the `main` branch and the `ios-release` workflow.
5.  Click **Start build**.

**The Result:** 
Codemagic will spin up a Mac in the cloud, build your web app, sync it to native iOS, digitally sign it with your new Apple account, and push it directly into App Store Connect. 

Within about 15-20 minutes, you will receive an email from Apple telling you your build is ready to be tested in TestFlight!
