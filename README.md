# ATMOSCHAIN 🌍⚙️🔗

**Intelligent Waste Management, Plasma Simulation & Carbon Credit Trading Ecosystem**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-Prototype%20%2F%20Hackathon%20Build-orange.svg)

ATMOSCHAIN is a tripartite system architecture consisting of a Computer Vision pipeline, a thermodynamic simulation engine, and an automated ERC-20 token generation system. It aims to solve the problem of open-air landfill emissions (specifically methane) by theoretically redirecting Municipal Solid Waste (MSW) to high-temperature Plasma Gasification plants and rewarding participants via tokenized carbon credits.

## 🏗️ System Architecture

The system is composed of three tightly coupled modules. The user flow is sequential: 
`A user scans waste -> Gets AI Analysis -> Simulates its destruction -> Mints Carbon Credits.`

### 1. WasteVision AI (Machine Learning & C.V.)
The primary purpose of the ML integration is to identify waste at the source and calculate its real-world climate hazard (Methane Potential).
* **Image Classification:** Uses Google Gemini 2.0 Flash Vision API for real-time, highly accurate edge-case detection via webcam feed.
* **Methane Prediction Engine:** Uses the IPCC (Intergovernmental Panel on Climate Change) First-Order Decay (FOD) Model to calculate how many kilograms of CH4 (Methane) an item would produce over its lifetime in an anaerobic landfill, converting it to CO2-equivalent (CO2e).

### 2. PlasmaSim Optimizer (Simulation)
Simulates Plasma Gasification, the process of using 5000°C plasma arcs to break down waste at the molecular level, creating clean Syngas instead of toxic ash/smoke.
* **Thermodynamic Pipeline:** Simulates the four stages of a real industrial gasification plant: Plasma Reactor, Cyclone Separator, Gas Scrubber, and Fractionation Tower.
* **Gas Yield & Energy Prediction:** Based on waste type, it determines the exact volumetric yield of Syngas and calculates the theoretical thermal and electrical energy output (kWh).

### 3. CCTS SmartMarket (Blockchain Tokenization)
Carbon Credit Trading System (CCTS) decentralizes the issuance and tracking of carbon offsets.
* **Smart Contract:** Uses an ERC-20 Token named `CarbonCreditToken (CCT)`.
* **Mechanism:** Allows the protocol to `mint()` tokens based on verified metric tonnes of CO2e avoided. Corporate buyers can `retire()` the token to claim environmental benefits. 
* **Integration:** Converts prevented Methane emissions (verified by WasteVision & PlasmaSim) into equivalent Carbon Credits mapped to an immutable on-chain record.

---

## 💻 Tech Stack

* **Frontend:** Next.js (TypeScript), Tailwind CSS
* **Backend:** FastAPI (Python), Uvicorn
* **AI & Machine Learning:** Google Gemini 2.0 Flash Vision API, IPCC Mathematical Models
* **Blockchain:** Web3, Solidity (ERC-20)

---

## 🚀 Getting Started

### Prerequisites
* Python 3.9+
* Node.js & npm
* Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd ATMOSCHAIN
   ```

2. **Backend Setup:**
   * Install Python dependencies:
     ```bash
     pip install -r requirements.txt
     ```
   * Create a `.env` file in the root directory and add your Gemini API Key:
     ```env
     GEMINI_API_KEY=your_gemini_api_key_here
     ```

3. **Frontend Setup:**
   * Navigate to the frontend directory and install dependencies:
     ```bash
     cd frontend
     npm install
     ```

### Running the Application

You can easily launch both the backend and frontend at the same time using the provided batch script on Windows:

```bash
run_project.bat
```

**Manual Startup:**

* **Terminal 1 (Backend):**
  ```bash
  cd ATMOSCHAIN
  python -m uvicorn backend.api.app:app --reload --port 8000
  ```
* **Terminal 2 (Frontend):**
  ```bash
  cd ATMOSCHAIN/frontend
  npm run dev
  ```

Once running, visit **`http://localhost:3000`** in your browser to explore the ATMOSCHAIN ecosystem.
Backend API documentation is available at `http://localhost:8000/docs`.

---

## 📁 Repository Structure

* `backend/` - FastAPI Python Server
* `frontend/` - Next.js TypeScript User Interface
* `ml_models/` - Core Machine Learning, Methane Models, & Gemini Vision Integrations
* `simulation/` - Thermodynamic Physics Engine
* `blockchain/` - Web3 & Smart Contracts deployment scripts
* `analytics/` - Data Analysis & Financial modeling

## 📄 License
This project is built as a prototype / hackathon build.
