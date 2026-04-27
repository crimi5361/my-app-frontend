import { createContext, useState, useEffect, ReactNode } from "react";
import { User } from "../type/User";

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean | null;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const UserContext = createContext<UserContextType>({
  user: null,
  isAuthenticated: null,
  setUser: () => {},
  setIsAuthenticated: () => {},
});

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <UserContext.Provider
      value={{ user, isAuthenticated, setUser, setIsAuthenticated }}
    >
      {children}
    </UserContext.Provider>
  );
};
