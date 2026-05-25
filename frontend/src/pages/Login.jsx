import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AuthForm from '../components/shared/AuthForm';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    
    setError('');
    setSubmitting(true);
    const res = await login(email, password);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error || 'Invalid credentials');
      setPassword(''); // Clear password on failure
    }
    setSubmitting(false);
  };

  return (
    <AuthForm
      title="Welcome Back"
      subtitle="Neural Identity Authentication"
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      error={error}
      submitText="Establish Connection"
      alternateLinkText="Request Identity"
      alternateLinkTo="/signup"
      alternateLinkMessage="New Actor?"
    >
      <div className="space-y-2">
        <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Identity (Email)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800"
          placeholder="identity@network.io"
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between ml-1 pr-1">
          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest">Access Key</label>
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
          className="w-full pro-input !py-3 font-medium placeholder:text-zinc-800"
          placeholder="••••••••••••"
          required
        />
      </div>
    </AuthForm>
  );
};

export default Login;