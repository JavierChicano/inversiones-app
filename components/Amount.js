/**
 * Envuelve un valor sensible (importe, cantidad, P&L...) para que se difumine
 * cuando el modo privacidad está activo. No necesita contexto: solo añade la clase
 * `sensitive`, y el CSS global la oculta cuando <html data-privacy="on">.
 *
 * Uso: <Amount>{formatCurrency(total)}</Amount>
 *      <Amount as="div" className="text-lg">...</Amount>
 */
export default function Amount({ as: Tag = 'span', className = '', children, ...props }) {
  return (
    <Tag className={`sensitive ${className}`.trim()} {...props}>
      {children}
    </Tag>
  );
}
