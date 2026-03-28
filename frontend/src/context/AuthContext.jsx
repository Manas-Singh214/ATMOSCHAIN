import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

// Hardcoded demo users for the marketplace
const DEMO_USERS = [
  { username: 'admin',      password: 'atmoschain2024', role: 'Admin',    company: 'ATMOSCHAIN Core' },
  { username: 'indigo',     password: 'indigo123',      role: 'Buyer',    company: 'IndiGo Airlines' },
  { username: 'tata',       password: 'tata123',        role: 'Buyer',    company: 'Tata Steel Ltd.' },
  { username: 'reliance',   password: 'reliance123',    role: 'Buyer',    company: 'Reliance Industries' },
  { username: 'ecofarmer',  password: 'eco2024',        role: 'Seller',   company: 'EcoFarm Industries' },
  { username: 'greentech',  password: 'green2024',      role: 'Seller',   company: 'GreenTech Corp' },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');

  const login = (username, password) => {
    const found = DEMO_USERS.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    if (found) {
      setUser(found);
      setAuthError('');
      return true;
    }
    setAuthError('Invalid credentials. Check your username and password.');
    return false;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, authError, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
