import React, { useState } from 'react';
import { X, LogIn, UserPlus, LogOut } from 'lucide-react';
import { signInWithGoogle, signOutGoogle } from '../services/firebaseAuth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSignedIn: (profile: { id: string; name: string; email: string; photoURL?: string | null }) => void;
}

export const GoogleAuthModal: React.FC<Props> = ({ isOpen, onClose, onSignedIn }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      const u = result.user;
      onSignedIn({
        id: u.uid,
        name: u.displayName || u.email?.split('@')[0] || 'MKUU AI User',
        email: u.email || '',
        photoURL: u.photoURL,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Google sign-in imeshindikana. Hakikisha Google provider imewezeshwa Firebase Authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogle();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#0d0e12] border border-[#D4AF37]/30 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#22232a] flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-white">New User</div>
            <div className="text-xs text-[#8e95a2] mt-1">Tumia Google kuunda akaunti ya MKUU AI</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#8e95a2] hover:bg-[#1a1b22] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-3 disabled:opacity-60"
          >
            <LogIn className="w-5 h-5" />
            {loading ? 'Inaunganisha Google...' : 'Continue with Google'}
          </button>

          <div className="rounded-2xl bg-[#14151a] border border-[#282a33] p-3 text-xs text-[#aeb4c0] flex gap-2">
            <UserPlus className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>Kwa mara ya kwanza Google account yako itatengeneza Firebase user automatically. Hakuna username/password ya ziada.</span>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-950/40 border border-red-800/50 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 rounded-xl border border-[#282a33] text-[#8e95a2] hover:text-white flex items-center justify-center gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" />
            Sign Out Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleAuthModal;
