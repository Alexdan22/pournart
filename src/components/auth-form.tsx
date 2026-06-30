"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { loginAction, registerAction } from "@/app/actions/auth";
import type { ActionState } from "@/lib/types";

type AuthFormProps = {
  mode: "login" | "register";
  next?: string;
};

const initialState: ActionState = {};

export function AuthForm({ mode, next }: AuthFormProps) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form className="auth-form" action={formAction}>
      <input type="hidden" name="next" value={next ?? ""} />
      {mode === "register" ? (
        <label>
          <span>Name</span>
          <input name="name" autoComplete="name" required />
          {state.fieldErrors?.name ? <small>{state.fieldErrors.name[0]}</small> : null}
        </label>
      ) : null}
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
        {state.fieldErrors?.email ? <small>{state.fieldErrors.email[0]}</small> : null}
      </label>
      {mode === "register" ? (
        <label>
          <span>Phone</span>
          <input name="phone" autoComplete="tel" />
          {state.fieldErrors?.phone ? <small>{state.fieldErrors.phone[0]}</small> : null}
        </label>
      ) : null}
      <label>
        <span>Password</span>
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
        {state.fieldErrors?.password ? <small>{state.fieldErrors.password[0]}</small> : null}
      </label>
      {state.message ? <p className="form-message">{state.message}</p> : null}
      <button className="primary-button" disabled={pending} type="submit">
        {mode === "login" ? "Login" : "Create account"}
        <ArrowRight aria-hidden size={18} />
      </button>
    </form>
  );
}
