import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AuthForm from '../components/shared/AuthForm';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Basic password strength logic
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, text: 'None', color: 'bg-zinc-800' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    switch (score) {
      case 0:
      case 1: return { score, text: 'Weak', color: 'bg-rose-500' };
      case 2: return { score, text: 'Fair', color: 'bg-amber-500' };
      case 3: return { score, text: 'Good', color: 'bg-blue-500' };
      case 4: return { score, text: 'Strong', color: 'bg-emerald-500' };
      default: return { score: 0, text: 'None', color: 'bg-zinc-800' };
    }
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Protocol Key must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Protocol Keys do not match.');
      return;
    }
    
    setError('');
    setSubmitting(true);
    const res = await signup(email, password);
    if (res.success) {
      navigate('/login?message=Neural+Identity+Generated');
    } else {
      setError(res.error || 'Failed to initialize identity');
    }
    setSubmitting(false);
  };

  return (
    <AuthForm
      title="Join the Network"
      subtitle="Neural Identity Initialization"
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      error={error}
      submitText="Request Initialization"
      alternateLinkText="Authenticate"
      alternateLinkTo="/login"
      alternateLinkMessage="Already provisioned?"
    >
      <div className="space-y-2">
        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Desired Identity (Email)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800 shadow-inner"
          placeholder="identity@network.io"
          required
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between ml-1 pr-1">
          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Secure Protocol Key (Password)</label>
          <button 
            type="button" 
            onClick={() => setShowPassword(!showPassword)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800 shadow-inner"
          placeholder="••••••••••••"
          required
        />
        {/* Password Strength Indicator */}
        {password && (
          <div className="pt-1 flex items-center justify-between px-1">
            <div className="flex gap-1 flex-1 mr-4">
              {[1, 2, 3, 4].map(level => (
                <div 
                  key={level} 
                  className={`h-1 flex-1 rounded-full ${passwordStrength.score >= level ? passwordStrength.color : 'bg-zinc-800'}`}
                />
              ))}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-widest ${passwordStrength.score > 2 ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {passwordStrength.text}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between ml-1 pr-1">
          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Verify Protocol Key</label>
          <button 
            type="button" 
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <input
          type={showConfirmPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800 shadow-inner"
          placeholder="••••••••••••"
          required
        />
      </div>
    </AuthForm>
  );
};

export default Signup;