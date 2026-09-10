import { useContext } from 'react'
import { EnvironmentContext } from '../context/EnvironmentContext.jsx'

export function useEnvironment() {
  return useContext(EnvironmentContext)
}
