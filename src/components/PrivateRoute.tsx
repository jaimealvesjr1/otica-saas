import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PrivateRoute() {
  // Pegamos os dados do usuário e o status de carregamento do nosso "alto-falante"
  const { user, loading } = useAuth();

  // Enquanto o Firebase ainda está verificando se tem alguém logado, mostramos uma mensagem
  if (loading) {
    return <div style={{ padding: '20px' }}>Carregando sistema...</div>;
  }

  // Se o usuário existir, mostramos a tela que ele tentou acessar (<Outlet />)
  // Se não existir, redirecionamos ele para a tela "/login"
  return user ? <Outlet /> : <Navigate to="/login" />;
}
