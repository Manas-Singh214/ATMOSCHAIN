import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [methane, setMethane] = useState(null);
  const [carbonCredits, setCarbonCredits] = useState(0);
  
  // Standardized states across roles
  const [userBalance, setUserBalance] = useState(120);    // Unlisted CCTs
  const [userBudget, setUserBudget]   = useState(250000); // For 'Buyer' role (e.g., IndiGo Airlines)
  const [userRevenue, setUserRevenue] = useState(0);      // For 'Seller' role
  
  const [analysisResult, setAnalysisResult] = useState(null);
  const [reactorResult, setReactorResult] = useState(null);

  return (
    <AppContext.Provider value={{
      methane, setMethane,
      carbonCredits, setCarbonCredits,
      userBalance, setUserBalance,
      userBudget, setUserBudget,
      userRevenue, setUserRevenue,
      analysisResult, setAnalysisResult,
      reactorResult, setReactorResult,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
