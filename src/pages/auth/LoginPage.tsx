
import React, { useState } from 'react';
import { User as UserIcon, Lock as LockIconSvg, Eye as EyeIcon, EyeOff as EyeOffIcon } from 'lucide-react';
import { User } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

interface LoginProps {
    onLoginSuccess: (user: User) => void;
    users: User[];
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, users }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const cleanEmail = email.trim();
        const cleanPassword = password.trim();

        if (!isSupabaseConfigured) {
            const demoUser: User = {
                id: 'demo-user-1',
                email: cleanEmail || 'admin@venapictures.com',
                password: '',
                fullName: 'Admin Demo',
                role: 'Admin',
                permissions: [],
            };
            onLoginSuccess(demoUser);
            setIsLoading(false);
            return;
        }

        console.log('[Login] Attempting login for:', cleanEmail);

        try {
            // 1. Sign in via Supabase Auth (Secure)
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: cleanPassword,
            });

            if (authError || !authData?.user) {
                console.warn('[Login] Auth error:', authError?.message);
                setError('Username atau kata sandi salah (atau belum terdaftar di Supabase Auth).');
                setIsLoading(false);
                return;
            }

            // 2. Jika berhasil, session JWT sekarang aktif sebagai "authenticated"
            // Kita sekarang aman untuk query tabel `users` (karena RLS mengizinkan authenticated user)
            const { data: dbUser, error: dbError } = await supabase
                .from('users')
                .select('id,email,full_name,role,permissions')
                .ilike('email', cleanEmail.replace(/[\\%_]/g, '\\$&'))
                .maybeSingle();

            let finalUser: User;
            if (dbUser && !dbError) {
                finalUser = {
                    id: dbUser.id,
                    email: dbUser.email,
                    password: '', // Jangan simpan password plain
                    fullName: dbUser.full_name || 'User',
                    role: dbUser.role || 'Admin',
                    permissions: dbUser.permissions || [],
                };
            } else {
                await supabase.auth.signOut();
                setError('Akun belum terdaftar pada sistem. Hubungi administrator.');
                setIsLoading(false);
                return;
            }

            onLoginSuccess(finalUser);
        } catch (err) {
            console.error('[Login] Error:', err);
            setError('Terjadi kesalahan jaringan atau server.');
        }

        setIsLoading(false);
    };

    return (
        <div className="login-page flex items-center justify-center min-h-screen bg-white p-4 relative overflow-hidden">
            <div className="w-full max-w-sm mx-auto relative z-10">
                <div className="login-card bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-white/50">
                    <div className="login-header text-center mb-8">
                        <div className="login-logo-wrap flex justify-center mb-6">
                            <img src="/assets/images/logos/light-logo.svg" alt="Vena Pictures" width="160" height="40" decoding="async" className="h-10 w-auto"  loading="lazy" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800">Login</h1>
                        <p className="text-sm text-slate-500 mt-2">Hey, masukkan detail Anda untuk masuk ke akun Anda</p>
                    </div>

                    <form className="login-form space-y-5" onSubmit={handleSubmit}>
                        {!isSupabaseConfigured && (
                            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs leading-relaxed">
                                <strong>Mode Pratinjau Demo:</strong> Database Supabase belum dikonfigurasi. Anda dapat langsung klik <strong>Log In</strong> untuk masuk sebagai Demo Admin.
                            </div>
                        )}
                        {error && (
                            <div className="login-error p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                        <div className="input-with-icon">
                            <UserIcon className="input-icon w-5 h-5" />
                            <input
                                id="email"
                                name="email"
                                type="text"
                                required={isSupabaseConfigured}
                                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
                                placeholder="Enter your username/email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="input-with-icon">
                            <LockIconSvg className="input-icon w-5 h-5" />
                            <input
                                id="password"
                                name="password"
                                type={isPasswordVisible ? 'text' : 'password'}
                                required={isSupabaseConfigured}
                                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-800"
                                style={{ paddingRight: '2.5rem' }}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                aria-label={isPasswordVisible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                            >
                                {isPasswordVisible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="button-primary w-full"
                            >
                                {isLoading ? 'Logging In...' : 'Log In'}
                            </button>
                        </div>
                    </form>

                    <div className="text-center mt-6">
                        <button
                            type="button"
                            onClick={() => {
                                window.location.hash = '#/home';
                            }}
                            className="login-back text-xs text-slate-500 hover:text-blue-600 transition-colors"
                        >
                            &larr; Kembali ke Beranda
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @media (max-width: 640px) {
                    #root .login-page {
                        padding-left: 12px !important;
                        padding-right: 12px !important;
                    }

                    #root .login-page .login-card {
                        box-sizing: border-box;
                        padding: 16px !important;
                        border-radius: 10px !important;
                    }

                    #root .login-page .login-header {
                        margin-bottom: 16px !important;
                    }

                    #root .login-page .login-logo-wrap {
                        margin-bottom: 14px !important;
                    }

                    #root .login-page .login-header h1 {
                        font-size: 22px !important;
                        line-height: 1.25 !important;
                    }

                    #root .login-page .login-header p {
                        font-size: 13px !important;
                        line-height: 1.45 !important;
                    }

                    #root .login-page .login-form > * + * {
                        margin-top: 8px !important;
                    }

                    #root .login-page .login-form .input-with-icon {
                        min-width: 0;
                    }

                    #root .login-page .login-form .input-with-icon input {
                        box-sizing: border-box;
                        width: 100%;
                        min-width: 0;
                        min-height: 40px !important;
                        height: 40px !important;
                        padding: 0 40px 0 36px !important;
                        font-size: 13px !important;
                        line-height: 1.25 !important;
                        border-radius: 8px !important;
                    }

                    #root .login-page .login-form .input-with-icon > button[type="button"] {
                        box-sizing: border-box;
                        width: 36px !important;
                        min-width: 36px !important;
                        min-height: 36px !important;
                        height: 36px !important;
                        max-height: none !important;
                        padding: 6px !important;
                    }

                    #root .login-page .login-error {
                        padding: 8px 10px !important;
                        font-size: 12px !important;
                        line-height: 1.35 !important;
                    }

                    #root .login-page .login-form button[type="submit"] {
                        box-sizing: border-box;
                        width: 100%;
                        min-height: 38px !important;
                        height: 38px !important;
                        max-height: none !important;
                        padding: 0 12px !important;
                        font-size: 13px !important;
                        line-height: 1.2 !important;
                        border-radius: 8px !important;
                    }

                    #root .login-page .login-back {
                        min-height: 32px !important;
                        max-height: none !important;
                        padding: 6px 8px !important;
                        font-size: 12px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Login;