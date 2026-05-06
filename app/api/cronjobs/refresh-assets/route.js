import { NextResponse } from 'next/server';
import { refreshAssetsForUsers } from '@/lib/services/assetRefresh.service';

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId } = body;

    // Si viene el header Authorization con el CRON_SECRET, es una llamada del cron job de GitHub Actions
    const authHeader = req.headers.get('authorization');
    const isCronJob = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    // Si no es cron job, se requiere userId
    if (!isCronJob && !userId) {
      return NextResponse.json({ error: 'User ID requerido' }, { status: 400 });
    }

    const result = await refreshAssetsForUsers({
      userIds: isCronJob ? [] : [userId],
      isCronJob,
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error en refresh-assets:", error);
    return NextResponse.json(
        { error: 'Error actualizando cartera', details: error.message }, 
        { status: 500 }
    );
  }
}
