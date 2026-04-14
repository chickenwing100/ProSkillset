import { createContext, useContext, useState, useEffect } from 'react'

const SavedContractorsContext = createContext()

export function SavedContractorsProvider({ children }) {
  const [savedContractors, setSavedContractors] = useState([])

  // Load saved contractors from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('savedContractors')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const sanitized = Array.isArray(parsed)
          ? parsed.filter((contractor) => {
            const email = String(contractor?.email || '').trim().toLowerCase()
            return Boolean(email) && !email.endsWith('@example.com')
          })
          : []
        setSavedContractors(sanitized)
      } catch (error) {
        console.error('Error loading saved contractors:', error)
      }
    }
  }, [])

  // Save to localStorage whenever savedContractors changes
  useEffect(() => {
    localStorage.setItem('savedContractors', JSON.stringify(savedContractors))
  }, [savedContractors])

  const saveContractor = (contractor) => {
    setSavedContractors(prev => {
      if (prev.some(c => c.id === contractor.id)) {
        return prev // Already saved
      }
      return [...prev, contractor]
    })
  }

  const unsaveContractor = (contractorId) => {
    setSavedContractors(prev => prev.filter(c => c.id !== contractorId))
  }

  const isContractorSaved = (contractorId) => {
    return savedContractors.some(c => c.id === contractorId)
  }

  return (
    <SavedContractorsContext.Provider value={{
      savedContractors,
      saveContractor,
      unsaveContractor,
      isContractorSaved
    }}>
      {children}
    </SavedContractorsContext.Provider>
  )
}

export function useSavedContractors() {
  const context = useContext(SavedContractorsContext)
  if (!context) {
    throw new Error('useSavedContractors must be used within a SavedContractorsProvider')
  }
  return context
}