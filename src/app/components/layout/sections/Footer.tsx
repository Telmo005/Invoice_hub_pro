import Link from 'next/link';
import styles from '@/styles/Footer.module.css';
import ContactWidget from './ContactWidget';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.simpleFooter}>
      <div className="container">
        <div className={styles.copyrightContainer}>
          <p className={styles.copyrightText}>
            © {year} Telmo Augusto Sigauque Junior -- Invoice Hub Pro. Todos os direitos reservados.
            <span className={styles.legalLinks}>
              <Link href="/about" className={styles.legalLink}>
                Sobre
              </Link>
              <Link href="/politica-de-privacidade" className={styles.legalLink}>
                Política de Privacidade
              </Link>
              <Link href="/termos-de-uso" className={styles.legalLink}>
                Termos de Uso
              </Link>
              <a href="mailto:telmo.sigauquejr@gmail.com" className={styles.legalLink}>
                telmo.sigauquejr@gmail.com
              </a>
              <ContactWidget />
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}