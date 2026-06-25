import {
  COMPANY,
  QUOTE_FOOTER_SUBTAG,
  QUOTE_FOOTER_TAGLINE,
  QUOTE_FOOTER_TERMS,
} from "@/lib/company";
import type { QuoteDocumentData, QuoteDocumentRoom } from "@/lib/quote-document";
import { formatCurrencyFull, formatDateLong } from "@/lib/utils";
import { IconMapPin, IconPhone } from "@tabler/icons-react";

const thClass =
  "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500";
const tdClass = "px-3 py-2.5 text-sm text-gray-800";
const sectionBarClass =
  "bg-cream px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-800";

interface QuoteDocumentProps {
  data: QuoteDocumentData;
  exportMode?: boolean;
}

const pageClass = (exportMode: boolean) =>
  exportMode
    ? "quote-page bg-white p-8 text-[12pt] leading-relaxed text-gray-900"
    : "quote-page rounded-md bg-white p-6 text-[12pt] leading-relaxed text-gray-900 shadow-sm sm:p-8 print:rounded-none print:p-0 print:shadow-none";

export default function QuoteDocument({
  data,
  exportMode = false,
}: QuoteDocumentProps) {
  const roomCount = data.rooms.length;
  const totalPages = 1 + roomCount;

  return (
    <div className={exportMode ? "quote-doc" : "quote-doc space-y-6 print:space-y-0"}>
      {/* Page 1 — summary */}
      <section className={pageClass(exportMode)}>
        <QuoteHeader exportMode={exportMode} />

        <div className="my-4 grid grid-cols-2 gap-px border border-gray-200 bg-gray-200 text-sm sm:grid-cols-4">
          <InfoCell label="Quote For" value={data.customerName} />
          <InfoCell label="Quote #" value={data.quoteNumber} />
          <InfoCell label="Date" value={formatDateLong(data.quoteDate)} />
          <InfoCell label="Valid For" value={`${data.validForDays} Days`} />
          <InfoCell
            label="Project"
            value={data.jobName}
            className="sm:col-span-2"
          />
          <InfoCell label="Notes" value={data.notes} className="sm:col-span-2" />
        </div>

        {/* Rooms summary */}
        <section className="mb-4">
          <div className={sectionBarClass}>Rooms Summary</div>
          {data.rooms.length === 0 ? (
            <p className="border border-t-0 border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              No rooms added yet.
            </p>
          ) : (
            <div className="border border-t-0 border-gray-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className={thClass}>Room</th>
                    <th className={thClass}>Cabinets (Total)</th>
                    <th className={thClass}>Items</th>
                    <th className={`${thClass} text-right`}>Room Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rooms.map((room, index) => (
                    <tr key={room.id} className="border-b border-gray-100">
                      <td className={tdClass}>
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-burgundy text-[10px] font-bold text-white">
                          {index + 1}
                        </span>
                        {room.name}
                      </td>
                      <td className={`${tdClass} tabular-nums text-gray-600`}>
                        {room.cabinetMultiplier}
                      </td>
                      <td className={`${tdClass} tabular-nums`}>
                        {room.itemCount}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums font-medium`}>
                        {formatCurrencyFull(room.roomTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
                    <td colSpan={3} className={tdClass}>
                      Total ({roomCount} {roomCount === 1 ? "Room" : "Rooms"})
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatCurrencyFull(data.roomsTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Services summary — at end of page 1 */}
        <section className="mb-5">
          <div className={sectionBarClass}>Services Summary</div>
          {data.services.length === 0 ? (
            <p className="border border-t-0 border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              No services added yet.
            </p>
          ) : (
            <div className="border border-t-0 border-gray-200">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className={`${thClass} w-12`}>Qty</th>
                    <th className={thClass}>Service</th>
                    <th className={thClass}>Description</th>
                    <th className={thClass}>Type</th>
                    <th className={`${thClass} text-right`}>Price</th>
                    <th className={`${thClass} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((service) => (
                    <tr key={service.id} className="border-b border-gray-100">
                      <td className={`${tdClass} tabular-nums`}>{service.qty}</td>
                      <td className={tdClass}>{service.name}</td>
                      <td className={`${tdClass} text-gray-600`}>
                        {service.description}
                      </td>
                      <td className={`${tdClass} text-gray-600`}>{service.type}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {formatCurrencyFull(service.price)}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums font-medium`}>
                        {formatCurrencyFull(service.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
                    <td colSpan={5} className={tdClass}>
                      Total Services
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatCurrencyFull(data.servicesTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Footer — notes + totals */}
        <footer className="grid grid-cols-1 gap-4 border-t border-gray-200 pt-4 sm:grid-cols-2">
          <div className="text-xs leading-relaxed text-gray-600">
            <p className="mb-2 font-semibold uppercase tracking-wide text-gray-500">
              Notes / Terms
            </p>
            <p>{QUOTE_FOOTER_TERMS}</p>
            <p className="mt-3 font-serif text-sm italic text-gray-700">
              {QUOTE_FOOTER_TAGLINE}
            </p>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {QUOTE_FOOTER_SUBTAG}
            </p>
          </div>

          <div className="rounded border border-gray-200 p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Rooms Total</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrencyFull(data.roomsTotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Services Total</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrencyFull(data.servicesTotal)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-2 text-base font-bold text-gray-900">
                <dt>Quote Total</dt>
                <dd className="tabular-nums">
                  {formatCurrencyFull(data.quoteTotal)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-gray-200 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Approval
              </p>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-gray-500">Signature:</span>
                  <span className="ml-2 inline-block min-w-[10rem] border-b border-gray-400" />
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <span className="ml-2 inline-block min-w-[8rem] border-b border-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </footer>

        <PageFooter page={1} total={totalPages} />
      </section>

      {/* Room detail pages — one room per page */}
      {data.rooms.map((room, index) => (
        <RoomDetailPage
          key={room.id}
          room={room}
          roomIndex={index + 1}
          page={index + 2}
          total={totalPages}
          quoteNumber={data.quoteNumber}
          exportMode={exportMode}
        />
      ))}
    </div>
  );
}

function QuoteHeader({ exportMode = false }: { exportMode?: boolean }) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 border-b border-gray-200 pb-5">
      <div className="flex items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={COMPANY.logoPath}
          alt={COMPANY.name}
          className="h-16 w-auto max-w-[160px] object-contain object-left"
        />
      </div>

      <div className="text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-wide text-gray-900">
          QUOTE
        </h1>
        <div className="mt-1 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-gray-300" />
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500">
            {COMPANY.tagline}
          </span>
          <span className="h-px w-10 bg-gray-300" />
        </div>
      </div>

      <div className="text-right text-xs leading-relaxed text-gray-700">
        <p className="text-sm font-bold text-gray-900">{COMPANY.name}</p>
        <p>{COMPANY.contactName}</p>
        <p className="mt-1">
          {!exportMode && <IconPhone size={12} className="mr-1 inline shrink-0" />}
          {COMPANY.phone}
        </p>
        <p>
          {!exportMode && (
            <IconMapPin size={12} className="mr-1 inline shrink-0 align-text-top" />
          )}
          {COMPANY.address}
        </p>
      </div>
    </header>
  );
}

function RoomDetailPage({
  room,
  roomIndex,
  page,
  total,
  quoteNumber,
  exportMode,
}: {
  room: QuoteDocumentRoom;
  roomIndex: number;
  page: number;
  total: number;
  quoteNumber: string;
  exportMode: boolean;
}) {
  return (
    <section className={pageClass(exportMode)}>
      <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={COMPANY.logoPath}
          alt={COMPANY.name}
          className="h-10 w-auto object-contain"
        />
        <div className="text-right text-xs text-gray-500">
          <p className="font-medium text-gray-800">{quoteNumber}</p>
          <p>Room {roomIndex} of {total - 1}</p>
        </div>
      </div>

      <div className={sectionBarClass}>
        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-burgundy text-[10px] font-bold text-white">
          {roomIndex}
        </span>
        {room.name}
      </div>

      <div className="grid grid-cols-3 gap-px border border-t-0 border-gray-200 bg-gray-200 text-sm">
        <InfoCell label="Wood Species" value={room.woodSpecies} />
        <InfoCell label="Finish" value={room.finish} />
        <InfoCell label="Door Style" value={room.doorStyle} />
      </div>

      <div className="mt-4 border border-gray-200">
        <p className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Items in this room
        </p>
        {room.items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            No items in this room.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={`${thClass} w-14`}>Qty</th>
                <th className={thClass}>Item</th>
                <th className={thClass}>Type</th>
                <th className={`${thClass} text-right`}>Price</th>
              </tr>
            </thead>
            <tbody>
              {room.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className={`${tdClass} tabular-nums`}>{item.qty}</td>
                  <td className={tdClass}>{item.name}</td>
                  <td className={`${tdClass} text-gray-600`}>{item.subtype}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatCurrencyFull(item.price)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
                <td colSpan={3} className={tdClass}>
                  Room Total
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {formatCurrencyFull(room.roomTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <PageFooter page={page} total={total} />
    </section>
  );
}

function InfoCell({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`bg-white px-3 py-2.5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-gray-900">{value}</p>
    </div>
  );
}

function PageFooter({ page, total }: { page: number; total: number }) {
  return (
    <div className="mt-6 flex items-end justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
      <span>
        Page {page} of {total}
      </span>
      <span className="text-center text-gray-400">
        Thank you for the opportunity to work with you!
      </span>
      <span className="w-16" />
    </div>
  );
}
