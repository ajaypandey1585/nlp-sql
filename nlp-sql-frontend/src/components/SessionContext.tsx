import React, { createContext, useContext, useState } from 'react';

// Define types
interface Query {
  id: string;  // Added unique ID for each query
  query: string;
  result: any;
  timestamp: Date; // Added timestamp for each query
}

interface Session {
  id: string;
  name: string;
  queries: Query[];
  timestamp: Date;
}

interface SessionContextType {
  sessions: Session[];
  currentSessionId: string;
  addSession: (name: string) => void;
  removeSession: (id: string) => void;
  setCurrentSessionId: (id: string) => void;
  addQueryToSession: (query: string, result: any) => void;
  clearSession: (id: string) => void;
  switchSession: (id: string) => void;
}

// Create context
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Create provider component
export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const defaultSession: Session = {
      id: 'default-session',
      name: 'Default Session',
      queries: [],
      timestamp: new Date(),
    };
    return [defaultSession];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>('default-session');

  const addSession = (name: string) => {
    const newSession: Session = {
      id: `session-${Date.now()}`,
      name,
      queries: [],
      timestamp: new Date(),
    };
    setSessions((prev) => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
  };

  const removeSession = (id: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(sessions[0]?.id || '');
    }
  };

  const switchSession = (id: string) => {
    setCurrentSessionId(id);
  };

  const addQueryToSession = (query: string, result: any) => {
    setSessions((prev) => {
      const newSessions = [...prev];
      const sessionIndex = newSessions.findIndex((s) => s.id === currentSessionId);

      if (sessionIndex !== -1) {
        // Create a new query entry with unique ID and timestamp
        const newQuery: Query = {
          id: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          query,
          result,
          timestamp: new Date()
        };

        // Always add the new query to the session
        newSessions[sessionIndex].queries.push(newQuery);
      }

      return newSessions;
    });
  };

  const clearSession = (id: string) => {
    setSessions((prev) =>
      prev.map((session) => (session.id === id ? { ...session, queries: [] } : session))
    );
  };

  const value = {
    sessions,
    currentSessionId,
    addSession,
    removeSession,
    setCurrentSessionId,
    addQueryToSession,
    clearSession,
    switchSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

// Custom hook for using the session context
export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export default SessionContext;