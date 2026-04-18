import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const SavedContractorsContext = createContext()
const STORAGE_KEY = 'savedContractors'
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizeId = (value) => String(value || '').trim().toLowerCase()

const normalizeContractor = (contractor) => {
  const email = normalizeEmail(contractor?.email)
  const id = normalizeId(contractor?.id || email)

  return {
    ...contractor,
    id,
    email
  }
}

export function SavedContractorsProvider({ children }) {
  const { user } = useAuth()
  const [savedContractors, setSavedContractors] = useState([])

  const loadFromStorage = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []

    try {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed)
        ? parsed
          .map(normalizeContractor)
          .filter((contractor) => {
            const email = String(contractor?.email || '').trim().toLowerCase()
            return Boolean(email) && !email.endsWith('@example.com')
          })
        : []
    } catch (error) {
      console.error('Error loading saved contractors:', error)
      return []
    }
  }

  const loadFromSupabase = async (currentUser) => {
    if (!isSupabaseConfigured || !currentUser?.email) return null

    try {
      const { data, error } = await supabase
        .from('saved_contractors')
        .select('*')
        .eq('user_email', normalizeEmail(currentUser.email))

      if (error) return null

      return (Array.isArray(data) ? data : [])
        .map((row) => {
          const contractorData = row.contractor_data && typeof row.contractor_data === 'object'
            ? row.contractor_data
            : {}

          return normalizeContractor({
            ...contractorData,
            id: row.contractor_id || contractorData.id || contractorData.email,
            email: row.contractor_email || contractorData.email
          })
        })
        .filter((contractor) => Boolean(contractor.id))
    } catch {
      return null
    }
  }

  const persistSavedContractorToSupabase = async (currentUser, contractor) => {
    if (!isSupabaseConfigured || !currentUser?.email || !contractor?.id) return

    const payload = {
      user_email: normalizeEmail(currentUser.email),
      contractor_id: normalizeId(contractor.id),
      contractor_email: normalizeEmail(contractor.email),
      contractor_data: contractor
    }

    try {
      const result = await supabase
        .from('saved_contractors')
        .upsert(payload, { onConflict: 'user_email,contractor_id' })

      if (result.error) {
        await supabase.from('saved_contractors').insert(payload)
      }
    } catch {
      // No-op: local state remains the fallback source.
    }
  }

  const removeSavedContractorFromSupabase = async (currentUser, contractorId) => {
    if (!isSupabaseConfigured || !currentUser?.email || !contractorId) return

    try {
      await supabase
        .from('saved_contractors')
        .delete()
        .eq('user_email', normalizeEmail(currentUser.email))
        .eq('contractor_id', normalizeId(contractorId))
    } catch {
      // No-op: local state remains the fallback source.
    }
  }

  // Load saved contractors from localStorage on mount
  useEffect(() => {
    const hydrate = async () => {
      const supabaseSaved = await loadFromSupabase(user)
      const nextSaved = supabaseSaved ?? loadFromStorage()
      setSavedContractors(nextSaved)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved))
    }

    void hydrate()
  }, [user])

  // Save to localStorage whenever savedContractors changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedContractors))
  }, [savedContractors])

  const saveContractor = (contractor) => {
    const normalized = normalizeContractor(contractor)
    if (!normalized.id) return

    setSavedContractors(prev => {
      if (prev.some(c => normalizeId(c.id) === normalizeId(normalized.id))) {
        return prev // Already saved
      }
      return [...prev, normalized]
    })

    void persistSavedContractorToSupabase(user, normalized)
  }

  const unsaveContractor = (contractorId) => {
    setSavedContractors(prev => prev.filter(c => normalizeId(c.id) !== normalizeId(contractorId)))
    void removeSavedContractorFromSupabase(user, contractorId)
  }

  const isContractorSaved = (contractorId) => {
    return savedContractors.some(c => normalizeId(c.id) === normalizeId(contractorId))
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