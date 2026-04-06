import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false); // 2. Novo estado para controlar o botão
  
  const navigate = useNavigate();
  const { user } = useAuth(); // 3. Puxamos o estado do utilizador

  // 4. O SEGREDO: O React fica a vigiar o 'user'. 
  // Só quando o AuthContext terminar de buscar TODOS os dados (incluindo o cargo), ele navega.
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEntrando(true);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
      setErro('E-mail ou senha incorretos.');
      console.error(error);
      setEntrando(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#f0f2f5' 
    }}>
      <div style={{ 
        padding: '30px', 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '350px'
      }}>
        <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'white' }}>
          <img src="/logo.png" alt="Ótica Milenium" style={{ maxWidth: '300px', maxHeight: '80px', textAlign: 'center' }} />
        </div>
        
        {erro && <p style={{ color: 'red', textAlign: 'center', fontSize: '14px' }}>{erro}</p>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" 
            placeholder="E-mail" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="password" 
            placeholder="Senha" 
            value={senha} 
            onChange={(e) => setSenha(e.target.value)} 
            required 
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button 
            type="submit" 
            disabled={entrando}
            style={{ 
              padding: '12px', 
              backgroundColor: entrando ? '#6c757d' : '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: entrando ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
            {entrando ? 'Aguarde...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
