import { useState } from 'react';

type Tab = 'privacy' | 'terms';

export function LegalPage() {
  const [tab, setTab] = useState<Tab>('privacy');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Legal</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Privacy Policy & Terms of Service</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('privacy')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            tab === 'privacy'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
              : 'bg-white dark:bg-white/5 text-slate-800 dark:text-gray-300 border border-gray-200 dark:border-white/10'
          }`}
        >
          Privacy Policy
        </button>
        <button
          onClick={() => setTab('terms')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            tab === 'terms'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
              : 'bg-white dark:bg-white/5 text-slate-800 dark:text-gray-300 border border-gray-200 dark:border-white/10'
          }`}
        >
          Terms of Service
        </button>
      </div>

      <div className="glass-card p-6 md:p-8 max-w-4xl">
        {tab === 'privacy' ? <PrivacyPolicy /> : <TermsOfService />}
      </div>
    </div>
  );
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold">{number}</span>
      <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
    </div>
  );
}

function Bullet({ label, detail }: { label: string; detail: string }) {
  return (
    <p className="text-sm text-slate-600 dark:text-slate-400 pl-4 mt-1">
      <span className="text-blue-500 mr-1">•</span>
      <span className="font-semibold text-gray-800 dark:text-gray-200">{label}:</span> {detail}
    </p>
  );
}

function PrivacyPolicy() {
  return (
    <div className="space-y-8 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
      <div className="text-center pb-4 border-b border-gray-100 dark:border-white/5">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">Tcheck Privacy Policy</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">KDPA 2019 Compliant · Last Updated: March 18, 2026 · Tallycheck Ltd</p>
      </div>

      <div>
        <SectionHeader number="1" title="Introduction & Legal Roles" />
        <p>Tallycheck Ltd processes personal data in strict compliance with the Kenya Data Protection Act, 2019 (KDPA). It is critical to understand the legal relationship regarding your data:</p>
        <Bullet label="The Data Controller" detail="Your enrolled University is the Data Controller. They mandate the collection of your attendance data as part of their academic operations and dictate how it is utilized." />
        <Bullet label="The Data Processor" detail="Tallycheck Ltd acts strictly as the Data Processor. We provide the software and hardware ecosystem (Tcheck) to securely collect, transmit, and store this data explicitly on the University's behalf." />
      </div>

      <div>
        <SectionHeader number="2" title="Exhaustive List of Data Collected" />
        <p>To fulfill our operational mandate, we collect and process the following specific data points:</p>
        <Bullet label="Identity Data" detail="Full Name, Student/Staff ID Number, University Email Address, and Role (Student/Lecturer)." />
        <Bullet label="Device Identity (Fingerprinting)" detail="Device version, and device model. This is strictly utilized for security auditing and to prevent account-sharing/spoofing." />
        <Bullet label="Proximity & Telemetry Data" detail="Timestamped logs (Check-In / Check-Out times), BLE signal strength (RSSI), and connection status relative to authorized Tcheck beacons installed in University classrooms." />
      </div>

      <div>
        <SectionHeader number="3" title="Explicit Disclaimer on GPS Location Tracking" />
        <p>Mobile operating systems (iOS and Android) inherently require users to grant "Location" permissions for apps to scan for external Bluetooth devices. Tallycheck Ltd strictly limits data collection to BLE proximity.</p>
        <p className="mt-2 font-semibold text-red-600 dark:text-red-400">We DO NOT ping, track, record, or store your GPS coordinates or absolute geographical location at any time, inside or outside of class.</p>
      </div>

      <div>
        <SectionHeader number="4" title="Lawful Basis & Purpose of Processing" />
        <p>Under KDPA regulations, our lawful basis for processing this data is the performance of a contract (facilitating your University's attendance requirements) and legitimate interest (ensuring the security and integrity of the academic system). We use this data to:</p>
        <Bullet label="Automate" detail="the logging of classroom attendance." />
        <Bullet label="Populate" detail="live dashboards and generate historical reports for University administrators." />
        <Bullet label="Detect" detail="anomalies, fraud, or abuse of the Tcheck system." />
        <p className="mt-2 font-semibold text-gray-800 dark:text-gray-200">We will never sell, rent, or distribute your personal data to third-party marketers, advertisers, or data brokers.</p>
      </div>

      <div>
        <SectionHeader number="5" title="Data Security & Hosting" />
        <p>Your data is encrypted both in transit (via HTTPS/TLS) and at rest. We utilize enterprise-grade cloud infrastructure to store your data securely. In the event of a data breach, Tallycheck Ltd will notify the Data Controller (your University) and the Office of the Data Protection Commissioner (ODPC) in accordance with KDPA timelines.</p>
      </div>

      <div>
        <SectionHeader number="6" title="Data Retention" />
        <p>Tallycheck Ltd does not hold your data indefinitely. Attendance logs and personal profiles are retained only for the duration specified in our Master Subscription Agreement with your University (typically the duration of your enrollment plus a mandated academic audit period). Upon expiration of this term, or upon a verified directive from the University, your data is permanently and securely erased or irreversibly anonymized.</p>
      </div>

      <div>
        <SectionHeader number="7" title="Your Rights Under the KDPA" />
        <p>Under Kenyan law, you possess specific rights regarding your personal data, including the right to access, object, correct, and request erasure.</p>
        <p className="mt-2 font-medium text-gray-800 dark:text-gray-200">Important Routing Notice: Because Tallycheck Ltd is the Data Processor, we cannot unilaterally alter or delete your official academic attendance records. All formal requests to exercise your KDPA rights must be submitted directly to your University's Data Protection Officer (DPO) or administrative office. Tallycheck Ltd will execute these requests immediately upon receiving authorization from the University.</p>
      </div>
    </div>
  );
}

function TermsOfService() {
  return (
    <div className="space-y-8 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
      <div className="text-center pb-4 border-b border-gray-100 dark:border-white/5">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">Tcheck End User License Agreement (EULA) & Terms of Service</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Last Updated: March 18, 2026 · Entity: Tallycheck Ltd</p>
      </div>

      <div>
        <SectionHeader number="1" title="Acceptance of Terms & Scope of License" />
        <p>By downloading, installing, accessing, or using the Tcheck mobile application ("App"), you ("User," "Student," "Lecturer") enter into a binding agreement with Tallycheck Ltd ("Company," "we," "us"). We grant you a revocable, non-exclusive, non-transferable, limited license to use the App solely for your personal, non-commercial use strictly in connection with the academic attendance tracking mandated by your educational institution ("University").</p>
      </div>

      <div>
        <SectionHeader number="2" title="Device, Network, and OS Requirements" />
        <p>The successful operation of Tcheck is entirely dependent on your personal hardware and network connection. You explicitly acknowledge and agree that:</p>
        <Bullet label="Hardware Readiness" detail="You must bring a functioning, adequately charged mobile device to your scheduled classes." />
        <Bullet label="Permissions" detail='You must grant and maintain OS-level permissions for Bluetooth (BLE), Background App Refresh, and Location Services. (Note: Location permissions are required by iOS/Android to scan for Bluetooth devices; Tcheck does NOT track your GPS coordinates).' />
        <Bullet label="Network Connectivity" detail="The App requires an active internet connection (Wi-Fi or cellular data) to synchronize attendance payloads with our servers. Tallycheck Ltd is not liable for missed attendance due to lack of data bundles, poor cellular reception, or University Wi-Fi outages." />
        <Bullet label="Device Integrity" detail='The App must not be installed or operated on "rooted," "jailbroken," or otherwise compromised devices.' />
      </div>

      <div>
        <SectionHeader number="3" title="Prohibited Conduct & Strict Anti-Spoofing Policy" />
        <p>The integrity of the Tcheck system is our core operational mandate. Any attempt to manipulate attendance data is a direct violation of this agreement. You explicitly agree NOT to:</p>
        <Bullet label="Spoof" detail='Use "mock location" apps, BLE spoofing hardware, or cloning software to simulate proximity to a classroom.' />
        <Bullet
          label="Proxy attendance"
          detail="Share your account credentials or physical device with another individual to falsify attendance (proxy attendance)."
        />
        <Bullet
          label="Reverse-engineering"
          detail="Reverse-engineer, decompile, or extract proprietary BLE UUID/Major/Minor configurations from the App or physical beacons."
        />
        <Bullet
          label="Tampering"
          detail="Tamper with, obstruct, or damage the physical Tcheck BLE beacons installed on University premises."
        />
        <p className="mt-2 font-semibold text-red-600 dark:text-red-400">Enforcement: Tallycheck Ltd utilizes anomaly detection. Violation of this clause grants us the right to immediately terminate your access to the App and automatically furnish digital forensic evidence of the spoofing attempt to your University&apos;s disciplinary board.</p>
      </div>

      <div>
        <SectionHeader number="4" title="Complete Academic Disclaimer & Limitation of Liability" />
        <p>Tallycheck Ltd is a technology provider; we are not an academic authority. We solely provide the infrastructure to log physical proximity timestamps.</p>
        <Bullet label="No Academic Liability" detail="To the maximum extent permitted by Kenyan law, Tallycheck Ltd assumes ZERO liability for any academic, financial, or disciplinary consequences resulting from the use, or inability to use, the App. This includes, but is not limited to: failing grades, loss of scholarships, expulsion, or docking of lecturer pay." />
        <Bullet label="Data Accuracy Disputes" detail="If you believe you were falsely marked absent due to hardware failure, you must utilize the University&apos;s approved manual escalation process (e.g., speaking to the Lecturer). Tallycheck Ltd will not manually alter database records based on student requests." />
        <Bullet label={'"As-Is" Provision'} detail='The App is provided "AS-IS" and "AS-AVAILABLE" without warranties of any kind, express or implied, including fitness for a particular purpose or 100% uninterrupted uptime.' />
      </div>

      <div>
        <SectionHeader number="5" title="Intellectual Property Rights" />
        <p>All source code, UI/UX designs, logos, proprietary algorithms, and database architectures associated with Tcheck remain the exclusive intellectual property of Tallycheck Ltd. You may not copy, modify, or distribute any part of the App.</p>
      </div>

      <div>
        <SectionHeader number="6" title="App Store & Play Store Beneficiaries" />
        <p>If you downloaded this App from the Apple App Store or Google Play Store, you acknowledge that Apple Inc. and Google LLC are not parties to this EULA, are not responsible for the App or its maintenance, and hold no liability for any claims related to the App.</p>
      </div>
    </div>
  );
}
