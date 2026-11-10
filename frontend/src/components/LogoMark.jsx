import logoSvg from '../assets/logo.svg';

export default function LogoMark({ size = 'md', showText = true }) {
  const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-10 w-10' : 'h-9 w-9';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <img src={logoSvg} alt="Study Buddy AI" className={`${dim} rounded-lg shrink-0`} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            Study Buddy <span className="text-blue-500">AI</span>
          </span>
        </div>
      )}
    </div>
  );
}

