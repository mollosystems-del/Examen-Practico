import { useState } from 'react';
import { ShieldCheck, LoaderCircle, ArrowRight, Eye, EyeOff, Leaf } from 'lucide-react';
import { api } from '../api';
import { Brand, Field } from '../components/ui';
export function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@farma.local'),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin((await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })).data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <div className="login-story">
        <Brand />
        <span className="story-kicker">
          <span /> CUIDAR EMPIEZA POR ORGANIZAR
        </span>
        <h1>
          Tu inventario
          <br />
          en equilibrio.
          <br />
          <em>
            Tu farmacia,
            <br />
            en buenas manos.
          </em>
        </h1>
        <p>
          Todo lo que necesitas para gestionar productos, controlar lotes y anticiparte a los vencimientos.
        </p>
        <div className="story-art">
          <div className="art-cross">✚</div>
          <div className="art-pill" />
          <div className="art-label">
            <ShieldCheck size={18} /> Cada lote, bajo control
          </div>
        </div>
        <div className="story-foot">
          GESTIÓN FARMACÉUTICA <span>HECHO PARA CUIDAR</span>
        </div>
      </div>
      <div className="login-form-area">
        <div className="login-top">
          <span>Un espacio para tu farmacia</span>
          <Leaf size={19} />
        </div>
        <form className="login-form" onSubmit={submit}>
          <span className="eyebrow">BIENVENIDO A FARMA</span>
          <h2>Qué bueno verte.</h2>
          <p>Ingresa a tu espacio de trabajo y toma el control de tu inventario.</p>
          {error && (
            <div className="form-error" role="alert">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}
          <Field label="Correo electrónico">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Contraseña">
            <div className="password-wrap">
              <input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
          <button className="btn primary login-submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                Ingresar a mi farmacia <ArrowRight size={18} />
              </>
            )}
          </button>
          <div className="login-secure">
            <ShieldCheck size={15} /> Acceso seguro · Sesión protegida
          </div>
        </form>
        <div className="login-bottom">
          Farma · Sistema de gestión de inventario <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}
