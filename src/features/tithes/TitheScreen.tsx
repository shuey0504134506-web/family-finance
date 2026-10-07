import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Amount } from '../../components/Amount';
import { AppHeader } from '../../components/AppHeader';
import { formatMonthYear } from '../../domain/dates';
import { buildTitheInputs, titheByMonth } from '../../domain/tithe';
import { scopesForMode } from '../../domain/types';
import { useTransactionsUpTo } from '../../hooks/useTransactionsUpTo';
import { useReadyAuth } from '../auth/AuthContext';
import { useMonth } from '../month/MonthContext';
import { useSettings } from '../settings/SettingsContext';
import { ScreenBack } from './ScreenBack';

/**
 * מסך מעשרות. החוב מצטבר מתחילת הנתונים ועד סוף החודש הנבחר, ואינו מתאפס בתחילת חודש.
 * הנוסחה עצמה נמצאת ב-src/domain/tithe.ts ונבדקת שם.
 */
export function TitheScreen() {
  const { user, profile } = useReadyAuth();
  const settings = useSettings();
  const month = useMonth();

  const scopes = scopesForMode(profile.accountMode);
  const hasHousehold = scopes.includes('household');
  const hasBusiness = scopes.includes('business');

  const household = useTransactionsUpTo(user.uid, 'household', month.selected, hasHousehold);
  const business = useTransactionsUpTo(user.uid, 'business', month.selected, hasBusiness);

  const loading = household.loading || business.loading;
  const error = household.error ?? business.error;

  const rows = useMemo(
    () =>
      titheByMonth(
        buildTitheInputs(household.items, business.items, {
          lastYearMonth: month.selected,
          countBusinessTithePayments: settings.countBusinessTithePayments,
          transferMode: settings.businessTransferMode,
        }),
        settings.titheBps,
      ),
    [household.items, business.items, month.selected, settings],
  );

  if (!hasHousehold) return <Navigate to="/" replace />;

  const current = rows[rows.length - 1];
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  const addedThisMonth =
    current && current.cumulative.requiredAgorot - (previous?.cumulative.requiredAgorot ?? 0);
  const paidThisMonth = current ? current.month.paidAgorot : 0;
  const percent = settings.titheBps / 100;

  return (
    <div className="app-shell scope-household">
      <AppHeader />
      <main className="content" aria-busy={loading}>
        <ScreenBack to="/household" label="חזרה למשק הבית" />
        <h1 className="scope-title">
          <span aria-hidden="true">🙏</span> מעשרות
        </h1>

        {error ? (
          <div className="card error-card" role="alert">
            לא הצלחנו לטעון את הנתונים. יש לבדוק את החיבור ולנסות שוב.
          </div>
        ) : loading || !current ? (
          <div className="card notice-card" role="status">
            טוען נתונים…
          </div>
        ) : (
          <>
            <section className="card tithe-hero" aria-label="יתרת מעשרות מצטברת">
              <div className="muted">מצטבר עד סוף {formatMonthYear(month.selected)}</div>
              {current.cumulative.remainingAgorot > 0 ? (
                <>
                  <div className="tithe-label">נותר לתת</div>
                  <Amount agorot={current.cumulative.remainingAgorot} className="tithe-big tone-tithe" />
                </>
              ) : current.cumulative.surplusAgorot > 0 ? (
                <>
                  <div className="tithe-label">עודף שניתן</div>
                  <Amount agorot={current.cumulative.surplusAgorot} className="tithe-big tone-income" />
                </>
              ) : (
                <>
                  <div className="tithe-label">המעשר מאוזן</div>
                  <Amount agorot={0} className="tithe-big" />
                </>
              )}
            </section>

            <section className="card">
              <h2 className="card-title">פירוט מצטבר</h2>
              <dl className="detail-list">
                <div>
                  <dt>הכנסות משק הבית החייבות</dt>
                  <dd>
                    <Amount
                      agorot={
                        current.cumulative.liableIncomeAgorot -
                        Math.max(0, current.cumulativeBusinessNetAgorot)
                      }
                    />
                  </dd>
                </div>
                {hasBusiness && (
                  <div>
                    <dt>נטו העסק המצטבר</dt>
                    <dd>
                      <Amount
                        agorot={current.cumulativeBusinessNetAgorot}
                        className={current.cumulativeBusinessNetAgorot < 0 ? 'tone-expense' : undefined}
                      />
                    </dd>
                  </div>
                )}
                <div>
                  <dt>מעשר נדרש ({percent}%)</dt>
                  <dd>
                    <Amount agorot={current.cumulative.requiredAgorot} />
                  </dd>
                </div>
                <div>
                  <dt>מעשר ששולם</dt>
                  <dd>
                    <Amount agorot={current.cumulative.paidAgorot} />
                  </dd>
                </div>
              </dl>
              {current.cumulativeBusinessNetAgorot < 0 && (
                <p className="muted small">
                  העסק במינוס מצטבר. ההפסד מקטין רק את החלק של המעשר שנובע מהעסק, ואינו מקטין מעשר על
                  הכנסות אחרות של משק הבית.
                </p>
              )}
            </section>

            <section className="card">
              <h2 className="card-title">{formatMonthYear(month.selected)}</h2>
              <dl className="detail-list">
                <div>
                  <dt>{(addedThisMonth ?? 0) < 0 ? 'קיטון בחיוב החודש' : 'חיוב שנוסף החודש'}</dt>
                  <dd>
                    <Amount agorot={Math.abs(addedThisMonth ?? 0)} />
                  </dd>
                </div>
                <div>
                  <dt>שולם החודש</dt>
                  <dd>
                    <Amount agorot={paidThisMonth} />
                  </dd>
                </div>
              </dl>
            </section>

            {rows.length > 1 && (
              <section className="card">
                <h2 className="card-title">חודשים קודמים</h2>
                <ul className="tithe-months">
                  {[...rows]
                    .reverse()
                    .slice(1, 13)
                    .map((row) => (
                      <li key={row.yearMonth}>
                        <span>{formatMonthYear(row.yearMonth)}</span>
                        <span>
                          {row.cumulative.remainingAgorot > 0 ? (
                            <>
                              נותר <Amount agorot={row.cumulative.remainingAgorot} />
                            </>
                          ) : row.cumulative.surplusAgorot > 0 ? (
                            <>
                              עודף <Amount agorot={row.cumulative.surplusAgorot} />
                            </>
                          ) : (
                            'מאוזן'
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
