# 🍏 Apple iOS & iPadOS Installation Guide
**Enterprise Restaurant Billing System (msbillings)**

This document provides complete, step-by-step instructions for installing and setting up the **msbillings** mobile application on Apple iPhones and iPads for restaurant captains, waiters, cashiers, and managers.

---

## 📌 Important Note: How Apple iOS Differs from Android
Unlike Android (where `.apk` files can be installed directly by tapping on them), Apple enforces a strict security model ("Walled Garden"). **You cannot install an `.ipa` file by simply tapping it in WhatsApp, Safari, or the Files app.**

To install apps on an iPhone without downloading them from the Apple App Store, Apple requires the app to be digitally signed using an Apple ID or Apple Developer account. Below are the three official, proven methods to install the app onto any iPhone.

---

## 🥇 Method 1: Installing via Mac & Xcode (Recommended for In-House Staff & Captains)
This is the fastest and easiest method if you have access to a Mac computer. It takes less than 2 minutes per iPhone and is 100% free.

### **Step 1: Connect the iPhone to Your Mac**
1. Plug the staff/captain iPhone into your Mac using a USB or Lightning/Type-C charging cable.
2. If a prompt appears on the iPhone asking **"Trust This Computer?"**, tap **Trust** and enter the iPhone passcode.

### **Step 2: Open the Project in Xcode**
1. Open your Mac Terminal and navigate to the project directory:
   ```bash
   cd /Users/apple/Bilings/restaurat-billing/Restaurant_Billing_System/Frontend
   npx cap open ios
   ```
2. Apple's **Xcode** application will automatically launch with the project opened.

### **Step 3: Configure Apple Signing (15 Seconds)**
1. In the left sidebar of Xcode, click on the top blue project icon: **`PROJECT ➔ App`**.
2. Just below it in the left sidebar, click on **`TARGETS ➔ App`** *(the one with the blue app icon)*.
3. At the top of the middle editor screen, click the **Signing & Capabilities** tab.
4. Check the box labeled **"Automatically manage signing"**.
5. In the **Team** dropdown box, select your **Personal Team (Your Apple ID)**.
   * *If no account is listed, click **Add an Account...** and sign in with your free Apple ID email and password.*

### **Step 4: Select iPhone & Press Play**
1. Look at the top-center menu bar in Xcode: click on the device selector dropdown and select the connected iPhone (e.g., `Captain iPhone` or `iPhone`).
2. Click the large black triangle **▶️ Play / Run Button** in the top-left corner of Xcode.
3. Xcode will compile the app and install it directly onto the iPhone home screen within 30 seconds!

---

### **Step 5: The Mandatory 10-Second "Trust" Verification on iPhone**
When using a free Personal Apple ID, Apple installs the app on the iPhone home screen but blocks launching it until you verify trust once in iPhone Settings:
1. Pick up the iPhone and open the **Settings** app.
2. Navigate to **General ➔ VPN & Device Management** *(on some iOS versions, it is called **Device Management** or **Profiles & Device Management**)*.
3. Under the **"DEVELOPER APP"** section, tap on the Apple ID email used in Xcode.
4. Tap the blue button labeled **"Trust [Your Apple ID]"** and tap **Trust** again on the confirmation popup.
5. Go back to the iPhone home screen and tap the **msbillings** app icon—it will open instantly with crisp, high-contrast branding!

---

## 🥈 Method 2: Installing via "Sideloadly" or "3uTools" (Windows PC or Mac without Xcode)
If you are using a Windows PC or want to install the pre-compiled `.ipa` file directly without opening Xcode:

1. **Locate the `.ipa` Package:**
   The pre-compiled iOS application bundle is located at:
   `Desktop/dist/msbilling-ios-1.4.4.ipa`
2. **Download Sideloadly:**
   Download and install the free official iOS installer app from [sideloadly.io](https://sideloadly.io) (available for Mac and Windows).
3. **Connect & Install:**
   * Connect the iPhone to the computer via USB cable.
   * Open Sideloadly and drag-and-drop `msbilling-ios-1.4.4.ipa` into the app box.
   * Enter your Apple ID email address and click **Start**.
   * Enter your Apple ID password / verification code when prompted. Sideloadly will install the app onto the iPhone in ~15 seconds!
4. **Verify Trust:**
   * Follow **Step 5** from Method 1 above (`Settings ➔ General ➔ VPN & Device Management ➔ Trust`) before opening the app for the first time.

---

## 🥉 Method 3: Apple TestFlight (Best for 1-Click Wireless Distribution)
If you want restaurant captains, waiters, or clients to download and install the app wirelessly with 1 click from anywhere without plugging into a computer:

1. **Enroll in Apple Developer Program:** Requires an Apple Developer account ($99/year).
2. **Archive in Xcode:** In Xcode on your Mac, select **Product ➔ Destination ➔ Any iOS Device (arm64)**, then click **Product ➔ Archive**.
3. **Upload to App Store Connect:** In the Organizer window, click **Distribute App ➔ TestFlight & App Store**.
4. **Share Public Link:** Once uploaded, Apple generates an **instant public TestFlight link**. You can share this link via WhatsApp or email—anyone who taps it on an iPhone can install the app cleanly with 1 tap!

---

## 🔑 Staff Login Credentials Reference Table
Once the app is open on the iPhone, staff members can log in using their assigned role credentials:

| Role | Username | Password | Access Permissions & Features |
| :--- | :--- | :--- | :--- |
| **🧑‍✈️ Captain / Waiter** | `captain` *(or `captain1`)* | `captain123` | **Table & KOT Management:** Take customer orders, select tables, fire KOTs to kitchen/bar printers, check order status. Cannot view billing/reports. |
| **💵 Cashier / Billing** | `cashier` *(or `cashier1`)* | `cashier123` | **Billing & Settlement:** Generate invoices, apply discounts/taxes, settle bills (Cash/Card/UPI), print receipts, manage cash drawer. |
| **👑 Restaurant Admin** | `demo restaurant` *(or `admin`)* | `demopassword123` *(or `adminpassword123`)* | **Full Dashboard & Owner Access:** View live sales analytics, day book reports, menu & pricing management, expense tracking, and system settings. |

---

## ❓ Frequently Asked Questions & Troubleshooting

### **Q1: Why does the app say "Untrusted Developer Certificate" when tapped?**
* **Cause:** This is a standard Apple security check when sideloading apps with a free Apple ID.
* **Fix:** Open iPhone **Settings ➔ General ➔ VPN & Device Management**, tap your Apple ID email, and tap **Trust**.

### **Q2: Why does the app say "Invalid credentials" when logging in?**
* **Cause:** Typing an incorrect username/password or using an outdated database account.
* **Fix:** Ensure you are entering `captain` / `captain123` or `cashier` / `cashier123` exactly as shown in the table above (case-sensitive).

### **Q3: What happens if an app installed via Free Apple ID stops opening after 7 days?**
* **Cause:** Free Apple ID signing certificates are valid for 7 days by Apple's design.
* **Fix:** Simply plug the iPhone back into the Mac/PC and press **Play** in Xcode (or click **Start** in Sideloadly). It takes 10 seconds and renews the app for another 7 days without losing any data or settings! *(For permanent installation without 7-day renewals, use Method 3: Apple TestFlight/App Store).*

---
*Document prepared for Enterprise Restaurant Billing System • Built with Capacitor & Apple Native iOS Support*
