// Validação de formato de e-mail. Não garante que o endereço existe de
// verdade — isso só a confirmação por e-mail do Supabase consegue checar
// (o usuário precisa clicar no link enviado antes da conta funcionar).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}
