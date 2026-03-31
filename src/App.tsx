import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import Clientes from './pages/Clientes';
import Fornecedores from './pages/Fornecedores';
import Estoque from './pages/Estoque';
import Vendas from './pages/Vendas';
import Relatorios from './pages/Relatorios';
import ContasReceber from './pages/ContasReceber';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Área Protegida (Exige Login) */}
          <Route element={<PrivateRoute />}>
            
            {/* O Dashboard engloba todas as telas (É ele quem desenha o Menu Lateral) */}
            <Route path="/" element={<Dashboard />}>
              <Route path="clientes" element={<Clientes />} />
              <Route path="vendas" element={<Vendas />} />
              <Route path="fornecedores" element={<Fornecedores />} />
              <Route path="estoque" element={<Estoque />} /> 
              <Route path="relatorios" element={<Relatorios />} /> 
              <Route path="receber" element={<ContasReceber />} />
            </Route>

          </Route>

          {/* Se digitar um endereço que não existe, joga de volta pro início */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
