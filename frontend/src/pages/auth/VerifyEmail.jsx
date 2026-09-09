import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, extractError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import Spinner from '../../components/ui/Spinner';
import AuthLayout from '../../components/layout/AuthLayout';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null });

  useEffect(() => {
    const verify = async () => {
      try {
        await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        toast.success('Email verified! You can now sign in.');
        navigate('/login');
      } catch (err) {
        setState({ loading: false, error: extractError(err, 'Verification failed.') });
      }
    };
    if (token) verify();
    else setState({ loading: false, error: 'Missing verification token.' });
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      {state.loading ? (
        <div className="flex justify-center py-8">
          <Spinner size={32} className="text-brand-600" />
        </div>
      ) : (
        <>
          <p className="text-sm text-rose-600">{state.error}</p>
          <Link to="/login" className="btn-secondary mt-4 block w-full text-center">Back to sign in</Link>
        </>
      )}
    </AuthLayout>
  );
}