import type { ComponentType } from 'react';

export type LeagueIconProps = {
  size?: number;
  className?: string;
};

// Bronze (1)
export function BronzeIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'bronze-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="20" fill="var(--bronze-6)" />
      <circle opacity="0.4" cx="24" cy="24" r="20" fill={`url(#${id}-g0)`} />
      <circle opacity="0.5" cx="24" cy="24" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <circle cx="24" cy="24" r="20" stroke="var(--bronze-8)" strokeWidth="4" />
      <g filter={`url(#${id}-f)`}>
        <path d="M22.514 14.4096C22.9777 13.2476 23.2096 12.6666 23.5414 12.4954C23.8291 12.3469 24.1709 12.3469 24.4586 12.4954C24.7904 12.6666 25.0223 13.2476 25.486 14.4095L29.077 23.4069C29.1645 23.626 29.2082 23.7356 29.2255 23.8487C29.2408 23.949 29.2408 24.051 29.2255 24.1513C29.2082 24.2644 29.1645 24.374 29.077 24.5931L25.486 33.5904C25.0223 34.7524 24.7904 35.3334 24.4586 35.5046C24.1709 35.6531 23.8291 35.6531 23.5414 35.5046C23.2096 35.3334 22.9777 34.7524 22.514 33.5904L18.923 24.5931C18.8355 24.374 18.7918 24.2644 18.7745 24.1513C18.7592 24.051 18.7592 23.949 18.7745 23.8487C18.7918 23.7356 18.8355 23.626 18.923 23.4069L22.514 14.4096Z" fill="white" />
        <path d="M24.0304 13.5313C24.1632 13.7945 24.3181 14.1812 24.5573 14.7805L28.1487 23.7774C28.1956 23.8948 28.2179 23.9538 28.233 23.997C28.2333 23.998 28.234 23.9988 28.2344 23.9998C28.234 24.0008 28.2341 24.0021 28.2337 24.0032C28.2186 24.0465 28.1949 24.1054 28.148 24.2228L24.5573 33.2191C24.3182 33.8181 24.1632 34.2051 24.0304 34.4683C24.0204 34.4881 24.0088 34.5055 24 34.5221C23.9912 34.5055 23.9796 34.4881 23.9696 34.4683C23.8368 34.2051 23.6818 33.8181 23.4427 33.2191L19.852 24.2228C19.8051 24.1054 19.7814 24.0465 19.7663 24.0032C19.7659 24.0021 19.766 24.0008 19.7656 23.9998C19.766 23.9988 19.7667 23.998 19.767 23.997C19.7821 23.9538 19.8044 23.8948 19.8513 23.7774L23.4427 14.7805C23.6819 14.1812 23.8368 13.7945 23.9696 13.5313C23.9799 13.5109 23.9909 13.493 24 13.476C24.0091 13.493 24.0201 13.5109 24.0304 13.5313Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <defs>
        <filter id={`${id}-f`} x="14.763" y="10.384" width="18.474" height="31.2319" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="30.66" y1="17.34" x2="17.34" y2="30.66" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Silver (2)
export function SilverIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'silver-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="20" fill="var(--gray-6)" />
      <circle opacity="0.4" cx="24" cy="24" r="20" fill={`url(#${id}-g0)`} />
      <circle cx="24" cy="24" r="20" stroke="var(--gray-8)" strokeWidth="4" />
      <circle opacity="0.5" cx="24" cy="24" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <g filter={`url(#${id}-f)`}>
        <path d="M23.0437 15.1288C23.3321 14.1852 24.6679 14.1852 24.9563 15.1288L27.0502 21.9791C27.0946 22.1245 27.1716 22.2578 27.2752 22.3689L32.1609 27.6074C32.8338 28.329 32.1659 29.4858 31.2046 29.2638L24.225 27.652C24.077 27.6178 23.923 27.6178 23.775 27.652L16.7954 29.2638C15.8341 29.4858 15.1662 28.329 15.8391 27.6074L20.7248 22.3689C20.8284 22.2578 20.9054 22.1245 20.9498 21.9791L23.0437 15.1288Z" fill="white" />
        <path d="M26.0938 22.2715C26.1826 22.5621 26.3367 22.8285 26.5439 23.0508L31.4297 28.2891L24.4502 26.6777C24.1541 26.6093 23.8459 26.6093 23.5498 26.6777L16.5703 28.2891L21.4561 23.0508C21.6633 22.8285 21.8174 22.5621 21.9062 22.2715L24 15.4209L26.0938 22.2715Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <defs>
        <filter id={`${id}-f`} x="11.5662" y="12.4211" width="24.8676" height="22.8706" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="24" y1="12" x2="24" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Gold (3)
export function GoldIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'gold-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="20" fill="var(--yellow-6)" />
      <circle opacity="0.4" cx="24" cy="24" r="20" fill={`url(#${id}-g0)`} />
      <circle cx="24" cy="24" r="20" stroke="var(--yellow-8)" strokeWidth="4" />
      <circle opacity="0.5" cx="24" cy="24" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <g filter={`url(#${id}-f)`}>
        <path d="M23.0697 14.3587C23.4027 13.5146 24.5973 13.5146 24.9303 14.3587L27.2348 20.2019C27.3364 20.4596 27.5404 20.6636 27.7981 20.7652L33.6413 23.0697C34.4854 23.4027 34.4854 24.5973 33.6413 24.9303L27.7981 27.2348C27.5404 27.3364 27.3364 27.5404 27.2348 27.7981L24.9303 33.6413C24.5973 34.4854 23.4027 34.4854 23.0697 33.6413L20.7652 27.7981C20.6636 27.5404 20.4596 27.3364 20.2019 27.2348L14.3587 24.9303C13.5146 24.5973 13.5146 23.4027 14.3587 23.0697L20.2019 20.7652C20.4596 20.6636 20.6636 20.4596 20.7652 20.2019L23.0697 14.3587Z" fill="white" />
        <path d="M26.3047 20.5684C26.508 21.0838 26.9162 21.492 27.4316 21.6953L33.2744 24L27.4316 26.3047C26.9162 26.508 26.508 26.9162 26.3047 27.4316L24 33.2744L21.6953 27.4316C21.492 26.9162 21.0838 26.508 20.5684 26.3047L14.7256 24L20.5684 21.6953C21.0838 21.492 21.492 21.0838 21.6953 20.5684L24 14.7256L26.3047 20.5684Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <defs>
        <filter id={`${id}-f`} x="9.72562" y="11.7256" width="28.5488" height="28.5488" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="24" y1="12" x2="24" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Amber (4)
export function AmberIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'amber-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="20" fill="var(--orange-6)" />
      <circle opacity="0.4" cx="24" cy="24" r="20" fill={`url(#${id}-g0)`} />
      <circle cx="24" cy="24" r="20" stroke="var(--orange-8)" strokeWidth="4" />
      <circle opacity="0.5" cx="24" cy="24" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <g filter={`url(#${id}-f)`}>
        <path d="M23.1033 13.817C23.4701 13.0737 24.5299 13.0737 24.8967 13.817L27.294 18.6745C27.4397 18.9696 27.7213 19.1742 28.047 19.2215L33.4075 20.0004C34.2277 20.1196 34.5552 21.1276 33.9617 21.7061L30.0828 25.4871C29.8471 25.7169 29.7396 26.0479 29.7952 26.3723L30.7109 31.7111C30.851 32.528 29.9936 33.151 29.26 32.7653L24.4653 30.2446C24.174 30.0915 23.826 30.0915 23.5347 30.2446L18.7401 32.7653C18.0064 33.151 17.149 32.528 17.2891 31.7111L18.2048 26.3723C18.2604 26.0479 18.1529 25.7169 17.9172 25.4871L14.0383 21.7061C13.4448 21.1276 13.7723 20.1196 14.5925 20.0004L19.953 19.2215C20.2787 19.1742 20.5603 18.9696 20.706 18.6745L23.1033 13.817Z" fill="white" />
        <path d="M26.3975 19.1172C26.6888 19.7074 27.252 20.1163 27.9033 20.2109L33.2637 20.9902L29.3848 24.7715C28.9136 25.2309 28.6984 25.8924 28.8096 26.541L29.7256 31.8799L24.9307 29.3594C24.3481 29.0531 23.6519 29.0531 23.0693 29.3594L18.2744 31.8799L19.1904 26.541C19.3016 25.8924 19.0864 25.2309 18.6152 24.7715L14.7363 20.9902L20.0967 20.2109C20.748 20.1163 21.3112 19.7074 21.6025 19.1172L24 14.2598L26.3975 19.1172Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <defs>
        <filter id={`${id}-f`} x="9.7352" y="11.2596" width="28.5296" height="27.6228" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="24" y1="12" x2="24" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Sapphire (5)
export function SapphireIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'sapphire-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="20" fill="var(--sky-6)" />
      <circle opacity="0.4" cx="24" cy="24" r="20" fill={`url(#${id}-g0)`} />
      <circle cx="24" cy="24" r="20" stroke="var(--sky-8)" strokeWidth="4" />
      <circle opacity="0.5" cx="24" cy="24" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <path opacity="0.5" d="M34.3923 17C35.1621 17 35.6432 17.8333 35.2583 18.5L30.0622 27.5L24.866 36.5C24.4811 37.1666 23.5189 37.1666 23.134 36.5L17.9378 27.5L12.7417 18.5C12.3568 17.8333 12.8379 17 13.6077 17L24 17L34.3923 17Z" fill="white" />
      <g filter={`url(#${id}-f)`}>
        <path d="M23.0823 12.1193C23.4303 11.3157 24.5697 11.3157 24.9177 12.1193L28.8039 21.094C28.8343 21.1644 28.8728 21.2311 28.9186 21.2927L34.7479 29.1457C35.2698 29.8487 34.7 30.8355 33.8302 30.7351L24.1147 29.6132C24.0385 29.6044 23.9615 29.6044 23.8853 29.6132L14.1698 30.7351C13.3 30.8355 12.7302 29.8487 13.2521 29.1457L19.0814 21.2927C19.1272 21.2311 19.1657 21.1644 19.1961 21.094L23.0823 12.1193Z" fill="white" />
        <path d="M27.8857 21.4912C27.9467 21.6319 28.0238 21.7655 28.1152 21.8887L33.9453 29.7412L24.2295 28.6201C24.0771 28.6025 23.9229 28.6025 23.7705 28.6201L14.0547 29.7412L19.8848 21.8887C19.9762 21.7655 20.0533 21.6319 20.1143 21.4912L24 12.5166L27.8857 21.4912Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <defs>
        <filter id={`${id}-f`} x="9.05247" y="9.5166" width="29.8951" height="27.2256" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="24" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Amethyst (6)
export function AmethystIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'amethyst-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="20" fill="var(--indigo-6)" />
      <circle opacity="0.4" cx="24" cy="24" r="20" fill={`url(#${id}-g0)`} />
      <circle cx="24" cy="24" r="20" stroke="var(--indigo-8)" strokeWidth="4" />
      <circle opacity="0.5" cx="24" cy="24" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <path opacity="0.5" d="M32.3568 14.1027C33.0229 14.0018 33.5962 14.5751 33.4953 15.2412L32.2217 23.6492C32.2066 23.7485 32.2066 23.8495 32.2217 23.9488L33.4953 32.3568C33.5962 33.0229 33.0229 33.5961 32.3568 33.4953L23.9488 32.2217C23.8495 32.2066 23.7485 32.2066 23.6492 32.2217L15.2412 33.4953C14.5751 33.5961 14.0018 33.0229 14.1027 32.3568L15.3763 23.9488C15.3913 23.8495 15.3913 23.7485 15.3763 23.6492L14.1027 15.2412C14.0018 14.5751 14.5751 14.0018 15.2412 14.1027L23.6492 15.3763C23.7485 15.3913 23.8495 15.3913 23.9488 15.3763L32.3568 14.1027Z" fill="white" />
      <g filter={`url(#${id}-f)`}>
        <path d="M23.1226 11.6042C23.502 10.9106 24.498 10.9106 24.8774 11.6042L28.8092 18.7933C28.901 18.9611 29.0389 19.099 29.2067 19.1908L36.3958 23.1226C37.0894 23.502 37.0894 24.498 36.3958 24.8774L29.2067 28.8092C29.0389 28.901 28.901 29.0389 28.8092 29.2067L24.8774 36.3958C24.498 37.0894 23.502 37.0894 23.1226 36.3958L19.1908 29.2067C19.099 29.0389 18.9611 28.901 18.7933 28.8092L11.6042 24.8774C10.9106 24.498 10.9106 23.502 11.6042 23.1226L18.7933 19.1908C18.9611 19.099 19.099 18.9611 19.1908 18.7933L23.1226 11.6042Z" fill="white" />
        <path d="M27.9316 19.2734C28.1151 19.6089 28.3911 19.8849 28.7266 20.0684L35.916 24L28.7266 27.9316C28.3911 28.1151 28.1151 28.3911 27.9316 28.7266L24 35.916L20.0684 28.7266C19.8849 28.3911 19.6089 28.1151 19.2734 27.9316L12.084 24L19.2734 20.0684C19.6089 19.8849 19.8849 19.6089 20.0684 19.2734L24 12.084L27.9316 19.2734Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <defs>
        <filter id={`${id}-f`} x="7.084" y="9.084" width="33.832" height="33.832" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="24" y1="10" x2="24" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Topaz (7)
export function TopazIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'topaz-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 49 50" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M23.1494 0.400177C23.8607 -0.133407 24.8387 -0.133407 25.55 0.400177L36.5756 8.67214L47.8499 16.602C48.5771 17.1135 48.8794 18.0437 48.5917 18.885L44.1317 31.9272L40.0739 45.1001C39.8121 45.9499 39.0208 46.5248 38.1318 46.5111L24.3497 46.2997L10.5676 46.5111C9.67858 46.5248 8.8873 45.9499 8.62555 45.1001L4.56772 31.9272L0.107744 18.885C-0.179948 18.0437 0.122294 17.1135 0.84954 16.602L12.1238 8.67214L23.1494 0.400177Z" fill="var(--violet-8)" />
      <circle cx="24.3497" cy="25.4997" r="20" fill="var(--violet-6)" />
      <circle opacity="0.4" cx="24.3497" cy="25.4997" r="20" fill={`url(#${id}-g0)`} />
      <circle cx="24.3497" cy="25.4997" r="20" stroke="var(--violet-8)" strokeWidth="4" />
      <circle opacity="0.5" cx="24.3497" cy="25.4997" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <g filter={`url(#${id}-f)`}>
        <path d="M23.5248 12.7033C23.922 12.1237 24.7774 12.1237 25.1746 12.7033L29.0861 18.4106C29.2161 18.6004 29.4076 18.7395 29.6282 18.8045L36.2649 20.7609C36.9389 20.9596 37.2032 21.773 36.7747 22.3299L32.5554 27.8136C32.4152 27.9959 32.342 28.221 32.3484 28.4509L32.5386 35.3674C32.5579 36.0697 31.8659 36.5725 31.2039 36.3371L24.6847 34.0188C24.468 33.9418 24.2314 33.9418 24.0147 34.0188L17.4955 36.3371C16.8335 36.5725 16.1415 36.0697 16.1608 35.3674L16.351 28.4509C16.3574 28.221 16.2842 27.9959 16.144 27.8136L11.9247 22.3299C11.4962 21.773 11.7605 20.9596 12.4345 20.7609L19.0712 18.8045C19.2918 18.7395 19.4833 18.6004 19.6133 18.4106L23.5248 12.7033Z" fill="white" />
        <path d="M28.2608 18.9763C28.5209 19.3557 28.9046 19.6333 29.3458 19.7634L35.9825 21.7204L31.7628 27.2038C31.4823 27.5683 31.3361 28.0184 31.3487 28.4782L31.5392 35.3952L25.0196 33.0768C24.5862 32.9228 24.1132 32.9228 23.6798 33.0768L17.1602 35.3952L17.3507 28.4782C17.3633 28.0184 17.2171 27.5683 16.9366 27.2038L12.7169 21.7204L19.3536 19.7634C19.7948 19.6333 20.1785 19.3557 20.4386 18.9763L24.3497 13.2682L28.2608 18.9763Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <path d="M23.0589 21.262C23.4956 20.6658 23.7139 20.3678 23.983 20.2617C24.2186 20.1688 24.4808 20.1688 24.7164 20.2617C24.9855 20.3678 25.2038 20.6658 25.6405 21.262L28.0519 24.5542C28.3006 24.8938 28.425 25.0636 28.473 25.2495C28.5154 25.4136 28.5154 25.5858 28.473 25.7499C28.425 25.9357 28.3006 26.1055 28.0519 26.4451L25.6405 29.7374C25.2038 30.3335 24.9855 30.6316 24.7164 30.7377C24.4808 30.8306 24.2186 30.8306 23.983 30.7377C23.7139 30.6316 23.4956 30.3335 23.0589 29.7374L20.6475 26.4451C20.3988 26.1055 20.2744 25.9357 20.2264 25.7499C20.184 25.5858 20.184 25.4136 20.2264 25.2495C20.2744 25.0636 20.3988 24.8938 20.6475 24.5542L23.0589 21.262Z" fill="var(--violet-9)" />
      <defs>
        <filter id={`${id}-f`} x="7.71666" y="10.2686" width="33.2661" height="32.1271" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="4.3497" y1="5.49969" x2="44.3497" y2="45.4997" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="24.3497" y1="7.5" x2="24.3497" y2="43.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="24.3497" y1="11.5" x2="24.3497" y2="39.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Ruby (8)
export function RubyIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'ruby-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 48 51" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path opacity="0.5" d="M25.2181 50.5428C24.4997 51.0945 23.5003 51.0945 22.7819 50.5428L13.8095 43.6525C13.6704 43.5457 13.518 43.4576 13.356 43.3906L2.90255 39.0655C2.06557 38.7192 1.56583 37.8536 1.68441 36.9556L3.16542 25.7401C3.18837 25.5663 3.18837 25.3902 3.16542 25.2164L1.68441 14.001C1.56583 13.103 2.06558 12.2374 2.90256 11.8911L13.356 7.56592C13.518 7.49889 13.6704 7.41086 13.8095 7.30409L22.7819 0.413745C23.5003 -0.137948 24.4997 -0.137948 25.2181 0.413746L34.1905 7.30409C34.3296 7.41086 34.4821 7.49889 34.644 7.56592L45.0974 11.8911C45.9344 12.2374 46.4342 13.103 46.3156 14.001L44.8346 25.2164C44.8116 25.3902 44.8116 25.5663 44.8346 25.7401L46.3156 36.9556C46.4342 37.8536 45.9344 38.7192 45.0974 39.0655L34.644 43.3906C34.482 43.4577 34.3296 43.5457 34.1905 43.6525L25.2181 50.5428Z" fill="var(--pink-7)" />
      <circle cx="24" cy="25.4783" r="20" fill="var(--pink-6)" />
      <circle opacity="0.4" cx="24" cy="25.4783" r="20" fill={`url(#${id}-g0)`} />
      <circle cx="24" cy="25.4783" r="20" stroke="var(--pink-8)" strokeWidth="4" />
      <circle opacity="0.5" cx="24" cy="25.4783" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <g filter={`url(#${id}-f)`}>
        <path d="M23.1518 12.8365C23.5434 12.2094 24.4566 12.2094 24.8482 12.8365L27.9182 17.7524C28.0944 18.0345 28.3993 18.2106 28.7317 18.2221L34.524 18.4228C35.2629 18.4484 35.7195 19.2392 35.3722 19.8919L32.6499 25.0086C32.4937 25.3022 32.4937 25.6543 32.6499 25.948L35.3722 31.0646C35.7195 31.7173 35.2629 32.5081 34.524 32.5337L28.7317 32.7345C28.3993 32.746 28.0944 32.922 27.9182 33.2042L24.8482 38.1201C24.4566 38.7472 23.5434 38.7472 23.1518 38.1201L20.0818 33.2042C19.9056 32.922 19.6007 32.746 19.2683 32.7345L13.476 32.5337C12.7371 32.5081 12.2805 31.7173 12.6278 31.0646L15.3501 25.948C15.5063 25.6543 15.5063 25.3022 15.3501 25.0086L12.6278 19.8919C12.2805 19.2392 12.7371 18.4484 13.476 18.4228L19.2683 18.2221C19.6007 18.2106 19.9056 18.0345 20.0818 17.7524L23.1518 12.8365Z" fill="white" />
        <path d="M27.0703 18.282C27.4227 18.8462 28.0324 19.1984 28.6973 19.2214L34.4893 19.4226L31.7666 24.5388C31.4542 25.126 31.4542 25.8305 31.7666 26.4177L34.4893 31.5339L28.6973 31.7351C28.0324 31.7581 27.4227 32.1103 27.0703 32.6746L24 37.5906L20.9297 32.6746C20.5773 32.1103 19.9676 31.7581 19.3027 31.7351L13.5107 31.5339L16.2334 26.4177C16.5458 25.8305 16.5458 25.126 16.2334 24.5388L13.5107 19.4226L19.3027 19.2214C19.9676 19.1984 20.5773 18.8462 20.9297 18.282L24 13.366L27.0703 18.282Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <path d="M22.7092 21.2406C23.1459 20.6444 23.3642 20.3463 23.6333 20.2403C23.8689 20.1474 24.1311 20.1474 24.3667 20.2403C24.6358 20.3463 24.8541 20.6444 25.2908 21.2406L27.7022 24.5328C27.9509 24.8724 28.0753 25.0422 28.1233 25.2281C28.1657 25.3922 28.1657 25.5643 28.1233 25.7284C28.0753 25.9143 27.9509 26.0841 27.7022 26.4237L25.2908 29.716C24.8541 30.3121 24.6358 30.6102 24.3667 30.7163C24.1311 30.8091 23.8689 30.8091 23.6333 30.7163C23.3642 30.6102 23.1459 30.3121 22.7092 29.716L20.2978 26.4237C20.0491 26.0841 19.9247 25.9143 19.8767 25.7284C19.8343 25.5643 19.8343 25.3922 19.8767 25.2281C19.9247 25.0422 20.0491 24.8724 20.2978 24.5328L22.7092 21.2406Z" fill="var(--pink-9)" />
      <defs>
        <filter id={`${id}-f`} x="8.50936" y="10.3661" width="30.9813" height="34.2242" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="4" y1="5.48" x2="44" y2="45.48" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="24" y1="7.48" x2="24" y2="43.48" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="24" y1="11.48" x2="24" y2="39.48" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Legend (9)
export function LegendIcon({ size = 48, className }: LeagueIconProps) {
  const id = 'legend-' + Math.random().toString(36).slice(2, 9);
  return (
    <svg width={size} height={size} viewBox="0 0 51 51" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path opacity="0.5" d="M13.7614 47.6378C12.833 47.7818 11.9296 47.2602 11.5901 46.3842L8.15397 37.5187C8.04331 37.2332 7.86859 36.9769 7.64325 36.7696L0.645952 30.3321C-0.0454232 29.696 -0.200902 28.6645 0.272274 27.8529L5.06121 19.6388C5.21543 19.3743 5.30685 19.0779 5.32844 18.7725L5.99876 9.28806C6.065 8.35093 6.77454 7.58623 7.70409 7.45015L17.1119 6.07292C17.4149 6.02857 17.7036 5.91525 17.9559 5.7417L25.7891 0.352317C26.563 -0.180186 27.6033 -0.102229 28.2893 0.53968L35.2317 7.03634C35.4553 7.24555 35.7239 7.40064 36.0169 7.48965L45.1144 10.2537C46.0132 10.5268 46.6009 11.3887 46.5267 12.3252L45.776 21.8036C45.7518 22.1089 45.798 22.4156 45.9111 22.7001L49.4223 31.5362C49.7692 32.4092 49.4617 33.4061 48.6833 33.932L40.8047 39.2547C40.551 39.4261 40.34 39.6535 40.188 39.9193L35.4689 48.1737C35.0026 48.9893 34.0316 49.3704 33.135 49.0897L24.0613 46.2486C23.7691 46.1571 23.4598 46.1339 23.1572 46.1808L13.7614 47.6378Z" fill="var(--red-7)" />
      <path opacity="0.2" d="M36.7036 2.88631C37.632 2.74236 38.5354 3.26395 38.8749 4.13991L42.3503 13.1067C42.461 13.3922 42.6357 13.6485 42.861 13.8558L49.9383 20.3669C50.6297 21.003 50.7852 22.0345 50.312 22.8461L45.4683 31.154C45.3141 31.4185 45.2227 31.7149 45.2011 32.0204L44.5231 41.6132C44.4569 42.5503 43.7473 43.315 42.8178 43.4511L33.3024 44.8441C32.9995 44.8884 32.7107 45.0018 32.4585 45.1753L24.5358 50.6263C23.7618 51.1588 22.7215 51.0808 22.0356 50.4389L15.0138 43.868C14.7902 43.6588 14.5216 43.5037 14.2286 43.4147L5.02718 40.6191C4.12829 40.346 3.54065 39.4841 3.61483 38.5476L4.37415 28.9608C4.39833 28.6556 4.3521 28.3489 4.23903 28.0643L0.687695 19.1273C0.340766 18.2542 0.648251 17.2574 1.4267 16.7315L9.39536 11.3479C9.64907 11.1765 9.86004 10.9491 10.012 10.6833L14.785 2.33463C15.2513 1.51905 16.2224 1.13793 17.1189 1.41864L26.2963 4.29218C26.5885 4.38367 26.8979 4.40685 27.2004 4.35993L36.7036 2.88631Z" fill="var(--red-6)" />
      <circle cx="25.1715" cy="25.3677" r="20" fill="var(--red-6)" />
      <circle opacity="0.4" cx="25.1715" cy="25.3677" r="20" fill={`url(#${id}-g0)`} />
      <circle cx="25.1715" cy="25.3677" r="20" stroke="var(--red-8)" strokeWidth="4" />
      <circle opacity="0.5" cx="25.1715" cy="25.3677" r="17" stroke={`url(#${id}-g1)`} strokeWidth="2" />
      <g filter={`url(#${id}-f)`}>
        <path d="M24.3015 12.9031C24.6846 12.2271 25.6585 12.2271 26.0416 12.9031L28.4742 17.1961C28.6798 17.559 29.0892 17.7562 29.5012 17.6907L34.3743 16.916C35.1417 16.794 35.7489 17.5554 35.4592 18.2764L33.6195 22.8549C33.464 23.242 33.5651 23.685 33.8732 23.9663L37.5172 27.2932C38.091 27.817 37.8743 28.7666 37.13 28.9896L32.4034 30.4059C32.0038 30.5257 31.7205 30.8809 31.6927 31.2972L31.3636 36.2205C31.3118 36.9957 30.4343 37.4183 29.7959 36.9755L25.7415 34.1631C25.3987 33.9253 24.9443 33.9253 24.6016 34.1631L20.5472 36.9755C19.9088 37.4183 19.0313 36.9957 18.9795 36.2205L18.6504 31.2972C18.6226 30.8809 18.3393 30.5257 17.9397 30.4059L13.213 28.9896C12.4687 28.7666 12.252 27.817 12.8258 27.2932L16.4699 23.9663C16.7779 23.685 16.8791 23.242 16.7235 22.8549L14.8839 18.2764C14.5942 17.5554 15.2014 16.794 15.9688 16.916L20.8418 17.6907C21.2538 17.7562 21.6632 17.559 21.8689 17.1961L24.3015 12.9031Z" fill="white" />
        <path d="M27.6041 17.689C28.0154 18.4148 28.834 18.8091 29.6579 18.6783L34.5309 17.9039L32.692 22.482C32.381 23.2561 32.5828 24.1421 33.1989 24.7047L36.8434 28.0318L32.1159 29.4478C31.317 29.6874 30.7508 30.3979 30.695 31.23L30.3659 36.1539L26.3112 33.3414C25.6257 32.866 24.7173 32.866 24.0319 33.3414L19.9772 36.1539L19.6481 31.23C19.5923 30.3979 19.0261 29.6874 18.2272 29.4478L13.4997 28.0318L17.1442 24.7047C17.7603 24.1421 17.9621 23.2561 17.651 22.482L15.8122 17.9039L20.6852 18.6783C21.5091 18.8091 22.3276 18.4148 22.7389 17.689L25.1715 13.3961L27.6041 17.689Z" stroke={`url(#${id}-g2)`} strokeWidth="2" />
      </g>
      <path d="M23.8807 21.13C24.3174 20.5339 24.5357 20.2358 24.8048 20.1297C25.0405 20.0369 25.3026 20.0369 25.5382 20.1297C25.8073 20.2358 26.0257 20.5339 26.4623 21.13L28.8737 24.4223C29.1225 24.7619 29.2468 24.9317 29.2949 25.1175C29.3373 25.2816 29.3373 25.4538 29.2949 25.6179C29.2468 25.8038 29.1225 25.9736 28.8737 26.3132L26.4623 29.6054C26.0257 30.2016 25.8073 30.4996 25.5382 30.6057C25.3026 30.6986 25.0405 30.6986 24.8048 30.6057C24.5357 30.4996 24.3174 30.2016 23.8807 29.6054L21.4693 26.3132C21.2206 25.9736 21.0962 25.8038 21.0482 25.6179C21.0058 25.4538 21.0058 25.2816 21.0482 25.1175C21.0962 24.9317 21.2206 24.7619 21.4693 24.4223L23.8807 21.13Z" fill="var(--red-9)" />
      <defs>
        <filter id={`${id}-f`} x="8.49958" y="10.3961" width="33.3439" height="32.759" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="2" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.5 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1" result="shape" />
        </filter>
        <linearGradient id={`${id}-g0`} x1="5.17" y1="5.37" x2="45.17" y2="45.37" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="0.25" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g1`} x1="25.17" y1="7.37" x2="25.17" y2="43.37" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-g2`} x1="25.17" y1="11.37" x2="25.17" y2="39.37" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0" />
          <stop offset="1" stopColor="#F0F0F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Export map for tier-to-icon mapping
export const LEAGUE_ICONS: Record<string, ComponentType<LeagueIconProps>> = {
  bronze: BronzeIcon,
  silver: SilverIcon,
  gold: GoldIcon,
  amber: AmberIcon,
  sapphire: SapphireIcon,
  amethyst: AmethystIcon,
  topaz: TopazIcon,
  ruby: RubyIcon,
  legend: LegendIcon,
};
