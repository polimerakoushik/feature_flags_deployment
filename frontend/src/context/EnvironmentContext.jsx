import { createContext, useState } from 'react'

export const EnvironmentContext = createContext(null)

export function EnvironmentProvider({ children }) {
  const [environment, setEnvironment] = useState('development')

  return (
    <EnvironmentContext.Provider value={{ environment, setEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  )
}
