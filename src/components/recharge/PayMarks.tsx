type MarkProps = { size?: number };

export function VisaMark({ size = 36 }: MarkProps) {
  return (
    <svg width={size} height={(size * 24) / 36} viewBox="0 0 36 24" role="img" aria-label="Visa">
      <rect width="36" height="24" rx="4" fill="#1A1F71" />
      <text x="18" y="16.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="12" fontWeight="800" fontStyle="italic" fill="#fff">VISA</text>
    </svg>
  );
}

export function MastercardMark({ size = 36 }: MarkProps) {
  return (
    <svg width={size} height={(size * 24) / 36} viewBox="0 0 36 24" role="img" aria-label="Mastercard">
      <rect width="36" height="24" rx="4" fill="#fff" stroke="#E5E7EB" />
      <circle cx="14" cy="12" r="7" fill="#EB001B" />
      <circle cx="22" cy="12" r="7" fill="#F79E1B" />
      <path d="M18 6.6a7 7 0 0 1 0 10.8 7 7 0 0 1 0-10.8z" fill="#FF5F00" />
    </svg>
  );
}

export function BitcoinMark({ size = 24 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Bitcoin">
      <circle cx="12" cy="12" r="12" fill="#F7931A" />
      <path fill="#fff" d="M16.6 10.4c.2-1.4-.9-2.1-2.3-2.6l.5-1.8-1.1-.3-.4 1.7-.9-.2.4-1.7-1.1-.3-.5 1.8-.7-.2-1.5-.4-.3 1.2s.8.2.8.2c.4.1.5.4.5.6l-.5 2-.1 0-.7 2.8c-.1.1-.2.3-.5.2 0 0-.8-.2-.8-.2l-.6 1.3 1.4.4.8.2-.5 1.9 1.1.3.5-1.8.9.2-.5 1.8 1.1.3.5-1.9c1.9.4 3.3.2 3.9-1.5.5-1.4 0-2.200-1-2.700.7-.2 1.300-.7 1.400-1.700zm-2.500 3.500c-.3 1.400-2.700.6-3.400.5l.6-2.400c.8.2 3.200.6 2.800 1.900zm.4-3.500c-.3 1.300-2.200.6-2.800.5l.5-2.200c.6.2 2.600.4 2.300 1.700z" />
    </svg>
  );
}

export function EthereumMark({ size = 24 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Ethereum">
      <circle cx="12" cy="12" r="12" fill="#627EEA" />
      <path fill="#fff" fillOpacity=".7" d="M12 3.500v6.100l5.200 2.300z" />
      <path fill="#fff" d="M12 3.500 6.800 11.900 12 9.600z" />
      <path fill="#fff" fillOpacity=".7" d="M12 16.200v4.300l5.200-7.200z" />
      <path fill="#fff" d="M12 20.500v-4.300l-5.200-2.900z" />
      <path fill="#fff" fillOpacity=".4" d="m12 15.200 5.200-3.300L12 9.600z" />
      <path fill="#fff" fillOpacity=".7" d="m6.800 11.900 5.200 3.300V9.600z" />
    </svg>
  );
}

export function UsdtMark({ size = 24 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="USDT">
      <circle cx="12" cy="12" r="12" fill="#26A17B" />
      <path fill="#fff" d="M13.100 13.200v-1.700c2.400.1 4.200.5 4.200 1 0 .4-1.800.9-4.200 1zm-2.200 0c-2.400-.1-4.200-.6-4.200-1s1.800-.9 4.200-1v1.700zm2.200-3.500V8.200h3.300V6H7.700v2.200H11v1.500c-2.700.1-4.700.7-4.700 1.400 0 .8 2 1.400 4.700 1.500V18h2.100v-5.400c2.700-.1 4.700-.7 4.700-1.500 0-.7-2-1.300-4.700-1.400z" />
    </svg>
  );
}

export function UsdcMark({ size = 24 }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="USDC">
      <circle cx="12" cy="12" r="12" fill="#2775CA" />
      <path fill="#fff" d="M14.900 13.800c0-1.300-.8-1.700-2.300-1.900-1.100-.2-1.300-.4-1.300-.9s.4-.8 1.100-.8c.6 0 1 .2 1.200.8.100.1.200.2.300.2h.7c.2 0 .3-.1.300-.3-.1-.7-.7-1.300-1.500-1.400v-.8c0-.2-.1-.3-.3-.3h-.6c-.2 0-.3.1-.3.3v.8c-1 .1-1.700.8-1.700 1.600 0 1.200.7 1.700 2.200 1.900 1 .2 1.300.4 1.300 1s-.5.9-1.200.9c-.9 0-1.200-.4-1.300-.9 0-.2-.2-.3-.3-.3h-.7c-.2 0-.3.1-.3.3.100.8.7 1.400 1.700 1.600v.8c0 .2.100.3.3.3h.6c.2 0 .3-.1.300-.3v-.8c1-.2 1.800-.9 1.800-1.800z" />
      <path fill="#fff" d="M9.800 18.700c-3.100-1.100-4.700-4.600-3.500-7.700.6-1.700 1.900-3 3.500-3.500.2-.1.300-.2.300-.4v-.6c0-.2-.1-.3-.3-.3h-.1c-3.800 1.200-5.900 5.200-4.700 9s5.200 5.900 9 4.700c2.200-.7 4-2.500 4.700-4.700.1-.2 0-.4-.2-.5h-.6c-.2 0-.3.1-.4.300-.7 2-2.100 3.400-3.500 3.500-.5.100-.9.100-.2.200z" />
      <path fill="#fff" d="M14.200 5.300c-.2-.1-.4 0-.4.200v.6c0 .2.100.3.3.4 2.500.8 4.200 3.400 3.800 6.100-.3 1.800-1.400 3.200-2.900 4-.2.100-.3.200-.3.400v.6c0 .2.200.3.400.2 3.700-1.200 5.700-5.100 4.500-8.800-.7-2.100-2.300-3.700-4.400-4.400z" />
    </svg>
  );
}

export function CoinMark({ coin, size = 24 }: { coin: string; size?: number }) {
  if (coin === "BTC") return <BitcoinMark size={size} />;
  if (coin === "ETH") return <EthereumMark size={size} />;
  if (coin === "USDT") return <UsdtMark size={size} />;
  return <UsdcMark size={size} />;
}
