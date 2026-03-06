# 🩸 BloodSheet Golf — iOS Submission Guide (Cloud Path) 🚀

Since your local Mac is a classic (2017), we are using **Codemagic** to build and submit the app in the cloud. This bypasses your local OS limits and ensures Apple gets a perfect build.

---

## 🏗 STEP 1: Connect your Code
1.  **Push to GitHub**: Ensure your project is pushed to a private GitHub repository.
2.  **Sign up at [Codemagic.io](https://codemagic.io)**: Link it to your GitHub account.
3.  **Add App**: Select **BloodSheetGolf.v1.1** from your list. It will automatically detect the `codemagic.yaml` file I just created for you.

---

## 🏗 STEP 2: Link Apple (Crucial)
Apple needs to know it's really you. You need to generate an **App Store Connect API Key**:
1.  Log in to [App Store Connect](https://appstoreconnect.apple.com/access/api).
2.  Go to **Users and Access** -> **Integrations** (at the top) -> **App Store Connect API**.
3.  Click **(+)** to generate a new key.
    *   Name: `Codemagic CI`
    *   Access: `Admin` (or App Manager)
4.  **Download the API Key (.p8 file)** immediately. Apple only lets you download it once!

---

## 🏗 STEP 3: Configure Codemagic UI
1.  In Codemagic, go to your App Settings -> **Environment variables**.
2.  Create a group named `apple_credentials`.
3.  Upload the `.p8` file you just downloaded and enter the **Issuer ID** and **Key ID** from App Store Connect.

---

## 🚀 The Result
Every time you push code to your `main` branch, Codemagic will:
1.  Power up a brand new M2 Mac Mini in the cloud.
2.  Compile your React code and wrap it in iOS code.
3.  **Automatically upload it to your App Store Connect account.**

You will receive an email from Apple saying "Your build is ready for TestFlight" usually within 15 minutes of a push!

---

## 🎨 What I've Prepared for the Cloud:
- [x] **`codemagic.yaml`**: The instruction set for the cloud robots.
- [x] **Safe Area Proofing**: The code is already updated to look perfect on the Dynamic Island.
- [x] **Native Assets**: The icons and splash screens are already bundled in the `ios` folder.
