import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

type PublicLocale = 'pt-BR' | 'en' | 'es';

const messages = {
  'pt-BR': {
    invalid: 'Não foi possível validar a verificação anti-bot.',
    unavailable:
      'A verificação anti-bot está temporariamente indisponível. Tente novamente em instantes.',
  },
  en: {
    invalid: 'The anti-bot verification could not be validated.',
    unavailable:
      'The anti-bot verification is temporarily unavailable. Please try again shortly.',
  },
  es: {
    invalid: 'No se pudo validar la verificación anti-bot.',
    unavailable:
      'La verificación anti-bot no está disponible temporalmente. Inténtalo de nuevo en unos instantes.',
  },
} satisfies Record<PublicLocale, Record<string, string>>;

interface TurnstileResponse {
  success?: boolean;
}

@Injectable()
export class TurnstileService {
  async verify(
    token: string | undefined,
    ip: string | undefined,
    localeValue: string,
  ): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret || secret.startsWith('TODO')) return;

    const locale: PublicLocale =
      localeValue === 'en' || localeValue === 'es'
        ? localeValue
        : 'pt-BR';

    if (!token?.trim()) {
      throw new BadRequestException(messages[locale].invalid);
    }

    const body = new URLSearchParams({
      secret,
      response: token.trim(),
    });

    if (ip) body.set('remoteip', ip);

    let response: Response;

    try {
      response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body,
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        messages[locale].unavailable,
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        messages[locale].unavailable,
      );
    }

    const result = (await response.json()) as TurnstileResponse;
    if (result.success !== true) {
      throw new BadRequestException(messages[locale].invalid);
    }
  }
}
