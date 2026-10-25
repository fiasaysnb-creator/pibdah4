import React, { useState } from 'react';
import { Lead, LeadStatus, ContactChannel } from '../../../types';
import { createSuggestion } from '../../../services/suggestions';
import { generateUUID } from '../../../utils/uuid';

interface SuggestionFormProps {
    setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
}

const SuggestionForm: React.FC<SuggestionFormProps> = ({ setLeads }) => {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Simpan ke Supabase suggestions
            await createSuggestion({
                name,
                contact,
                message,
                date: new Date().toISOString(),
                channel: 'SUGGESTION_FORM',
            });

            // Backward-compat: tetap dorong ke leads state agar metrik lama tetap berjalan
            const newLead: Lead = {
                id: generateUUID(),
                name: name,
                contactChannel: ContactChannel.SUGGESTION_FORM,
                location: 'Form Online',
                status: LeadStatus.DISCUSSION,
                date: new Date().toISOString().split('T')[0],
                notes: `Kontak: ${contact}\n\nPesan:\n${message}`
            };
            setLeads(prev => [newLead, ...prev]);
            setIsSubmitted(true);
        } catch (err) {
            alert('Gagal mengirim saran. Silakan coba lagi.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const Logo = () => (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="#FFF27A"/>
            <path d="M15.44 26L12 19.6667L15.44 13.3333H22.32L25.76 19.6667L22.32 26H15.44ZM17.18 23.8333H20.58L22.32 20.5833L20.58 17.3333H17.18L15.44 20.5833L17.18 23.8333Z" fill="#1E1E21"/>
        </svg>
    );

    if (isSubmitted) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-bg p-4">
                <div className="w-full max-w-lg p-8 text-center bg-brand-surface rounded-2xl shadow-lg border border-gray-700/50">
                    <h1 className="text-2xl font-bold text-brand-text-light">Terima Kasih!</h1>
                    <p className="mt-4 text-brand-text-primary">Saran dan masukan Anda telah berhasil kami terima. Tim kami akan segera meninjaunya.</p>
                     <button onClick={() => {
                        setIsSubmitted(false);
                        setName('');
                        setContact('');
                        setMessage('');
                     }} className="mt-6 button-primary">
                        Kirim Masukan Lain
                    </button>
                    <a href="#" className="mt-4 text-sm text-brand-text-secondary hover:underline block">Kembali ke Beranda</a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-brand-bg p-4">
            <div className="w-full max-w-lg p-8 space-y-6 bg-brand-surface rounded-2xl shadow-lg border border-gray-700/50">
                <div className="text-center space-y-3">
                     <div className="flex justify-center">
                        <Logo />
                    </div>
                    <h1 className="text-2xl font-bold text-brand-text-light">Formulir Saran & Masukan</h1>
                    <p className="text-sm text-brand-text-secondary">Punya ide atau pertanyaan untuk Vena Pictures? Kami ingin mendengarnya dari Anda!</p>
                </div>

                <form className="space-y-4 form-compact form-compact--ios-scale" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            className="input-field"
                            placeholder=" "
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <label htmlFor="name" className="input-label">Nama Anda</label>
                    </div>
                    <div className="input-group">
                        <input
                            id="contact"
                            name="contact"
                            type="text"
                            required
                            className="input-field"
                            placeholder=" "
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                        />
                        <label htmlFor="contact" className="input-label">Kontak (Email / No. WhatsApp)</label>
                    </div>
                    <div className="input-group">
                        <textarea
                            id="message"
                            name="message"
                            rows={5}
                            required
                            className="input-field"
                            placeholder=" "
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                         <label htmlFor="message" className="input-label">Pesan atau Saran Anda</label>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full button-primary"
                        >
                            {isSubmitting ? 'Mengirim...' : 'Kirim Masukan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SuggestionForm;