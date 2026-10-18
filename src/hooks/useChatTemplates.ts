/**
 * React Hook untuk Chat Templates
 * Menyediakan interface mudah untuk mengelola chat templates
 */

import { useState, useEffect, useCallback } from 'react';
import type { ChatTemplate, Profile } from '../types';
import {
  getChatTemplatesOffline,
  updateChatTemplateOffline,
  addChatTemplateOffline,
  deleteChatTemplateOffline,
  resetToDefaultTemplatesOffline,
  getChatTemplateByIdOffline,
  processTemplate,
  validateTemplate,
} from '../services/chatTemplatesOffline';
import { useOfflineSync } from './useOfflineSync';

export function useChatTemplates(userProfile?: Profile) {
  const [templates, setTemplates] = useState<ChatTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isOnline } = useOfflineSync();

  // Load templates
  const loadTemplates = useCallback(async () => {
    if (!userProfile) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getChatTemplatesOffline(userProfile);
      setTemplates(data);
    } catch (err: any) {
      console.error('[useChatTemplates] Error loading templates:', err);
      setError(err.message || 'Gagal memuat templates');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Update template
  const updateTemplate = useCallback(
    async (templateId: string, updates: Partial<ChatTemplate>) => {
      if (!userProfile) {
        throw new Error('User profile required');
      }

      try {
        setError(null);
        const updated = await updateChatTemplateOffline({ ...userProfile, chatTemplates: templates }, templateId, updates);
        setTemplates(updated);
        return updated;
      } catch (err: any) {
        console.error('[useChatTemplates] Error updating template:', err);
        setError(err.message || 'Gagal update template');
        throw err;
      }
    },
    [userProfile, templates]
  );

  // Add template
  const addTemplate = useCallback(
    async (newTemplate: Omit<ChatTemplate, 'id'>) => {
      if (!userProfile) {
        throw new Error('User profile required');
      }

      // Validate
      const validation = validateTemplate({ ...newTemplate, id: 'temp' } as ChatTemplate);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      try {
        setError(null);
        const updated = await addChatTemplateOffline({ ...userProfile, chatTemplates: templates }, newTemplate);
        setTemplates(updated);
        return updated;
      } catch (err: any) {
        console.error('[useChatTemplates] Error adding template:', err);
        setError(err.message || 'Gagal menambah template');
        throw err;
      }
    },
    [userProfile, templates]
  );

  // Delete template
  const deleteTemplate = useCallback(
    async (templateId: string) => {
      if (!userProfile) {
        throw new Error('User profile required');
      }

      try {
        setError(null);
        const updated = await deleteChatTemplateOffline(userProfile, templateId);
        setTemplates(updated);
        return updated;
      } catch (err: any) {
        console.error('[useChatTemplates] Error deleting template:', err);
        setError(err.message || 'Gagal menghapus template');
        throw err;
      }
    },
    [userProfile]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    if (!userProfile) {
      throw new Error('User profile required');
    }

    try {
      setError(null);
      const updated = await resetToDefaultTemplatesOffline(userProfile);
      setTemplates(updated);
      return updated;
    } catch (err: any) {
      console.error('[useChatTemplates] Error resetting templates:', err);
      setError(err.message || 'Gagal reset templates');
      throw err;
    }
  }, [userProfile]);

  // Get template by ID
  const getTemplateById = useCallback(
    async (templateId: string) => {
      if (!userProfile) return null;
      return getChatTemplateByIdOffline(userProfile, templateId);
    },
    [userProfile]
  );

  // Process template with variables
  const process = useCallback((template: string, variables: Record<string, string>) => {
    return processTemplate(template, variables);
  }, []);

  // Validate template
  const validate = useCallback((template: ChatTemplate) => {
    return validateTemplate(template);
  }, []);

  return {
    templates,
    loading,
    error,
    isOnline,
    updateTemplate,
    addTemplate,
    deleteTemplate,
    resetToDefaults,
    getTemplateById,
    processTemplate: process,
    validateTemplate: validate,
    reload: loadTemplates,
  };
}
