import { createContext, useContext } from 'react';

export const InputContext = createContext({});

const base = 'input';
const errorCls = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30';

export function Input({ className = '', error, name, validation, register, ...rest }) {
  const ctxRegister = useContext(InputContext).register;
  const r = register || ctxRegister;
  if (r && name) {
    return <input className={`${base} ${error ? errorCls : ''} ${className}`} {...rest} {...r(name, validation)} />;
  }
  return <input className={`${base} ${error ? errorCls : ''} ${className}`} {...rest} />;
}

export function Select({ className = '', error, name, validation, register, children, ...rest }) {
  const ctxRegister = useContext(InputContext).register;
  const r = register || ctxRegister;
  if (r && name) {
    return (
      <select className={`${base} ${error ? errorCls : ''} ${className}`} {...rest} {...r(name, validation)}>
        {children}
      </select>
    );
  }
  return (
    <select className={`${base} ${error ? errorCls : ''} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', error, name, validation, register, ...rest }) {
  const ctxRegister = useContext(InputContext).register;
  const r = register || ctxRegister;
  if (r && name) {
    return <textarea className={`${base} min-h-[90px] ${error ? errorCls : ''} ${className}`} {...rest} {...r(name, validation)} />;
  }
  return <textarea className={`${base} min-h-[90px] ${error ? errorCls : ''} ${className}`} {...rest} />;
}