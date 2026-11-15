import { X, Printer, Download } from 'lucide-react';
import type { SiteSettings, Service } from '../types/portfolio';

interface CvModalProps {
  settings: SiteSettings;
  services: Service[];
  onClose: () => void;
}

export function CvModal({ settings, services, onClose }: CvModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-modal-title"
    >
      <div className="bg-[#FFFFFF] text-[#181A18] border border-[#E0DDD5] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#E0DDD5] px-6 py-4 flex items-center justify-between gap-4 print:hidden">
          <h2 id="cv-modal-title" className="text-base font-semibold">
            Curriculum Vitae — {settings.owner_name}
          </h2>
          <div className="flex items-center gap-2">
            {settings.cv_url ? (
              <a
                href={settings.cv_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </a>
            ) : (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Save / Print CV
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close CV preview"
              className="p-2 text-[#5A5E58] hover:text-[#181A18] rounded-lg hover:bg-[#EFECE6] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="border-b border-[#E0DDD5] pb-6">
            <h3 className="text-2xl font-bold tracking-tight">{settings.owner_name}</h3>
            <p className="text-sm font-medium text-[#1B5E4A] mt-1">{settings.brand_name}</p>
            <p className="text-xs text-[#5A5E58] mt-3 leading-relaxed">
              {settings.address} · {settings.phone} · {settings.email}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#5A5E58] mb-2">Profile</h4>
            <p className="text-sm text-[#181A18] leading-relaxed whitespace-pre-line">
              {settings.about_bio}
            </p>
          </div>

          <div className="border-t border-[#E0DDD5] pt-6">
            <h4 className="text-xs font-semibold text-[#5A5E58] mb-3">Academic Background</h4>
            <p className="text-base font-semibold text-[#181A18]">{settings.education_degree}</p>
            <p className="text-sm text-[#5A5E58] mt-0.5">
              {settings.education_institution} · {settings.education_status}
            </p>
            {settings.education_details && (
              <p className="text-sm text-[#5A5E58] mt-2 leading-relaxed">{settings.education_details}</p>
            )}
          </div>

          <div className="border-t border-[#E0DDD5] pt-6">
            <h4 className="text-xs font-semibold text-[#5A5E58] mb-4">Core Capabilities</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {services.map((service) => (
                <div key={service.id}>
                  <p className="text-sm font-semibold text-[#181A18]">{service.title}</p>
                  <p className="text-xs text-[#5A5E58] mt-1 leading-relaxed">
                    {service.details.join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
