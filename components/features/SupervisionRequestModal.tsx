import React, { useState } from 'react';
import { SupervisionAgreement } from '../../types';
import { supervisionApi } from '../../lib/api';
import { isImmersiveInteractionEnabled } from '../../lib/local-settings';
import {
  X,
  Shield,
  User,
  Clock,
  Fingerprint,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface SupervisionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: SupervisionAgreement[];
  onSuccess?: () => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '永久';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const SupervisionRequestModal: React.FC<SupervisionRequestModalProps> = ({
  isOpen,
  onClose,
  requests,
  onSuccess,
}) => {
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showBiometric, setShowBiometric] = useState(false);
  const [pendingAccept, setPendingAccept] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doAccept = async (agreementId: number) => {
    setProcessingId(agreementId);
    setError(null);
    try {
      await supervisionApi.respond(agreementId, true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || '接受协议失败');
    } finally {
      setProcessingId(null);
      setPendingAccept(null);
    }
  };

  const handleAccept = async (agreementId: number) => {
    setPendingAccept(agreementId);

    if (isImmersiveInteractionEnabled()) {
      setShowBiometric(true);
      setTimeout(() => {
        setShowBiometric(false);
        doAccept(agreementId);
      }, 1500);
    } else {
      doAccept(agreementId);
    }
  };

  const handleReject = async (agreementId: number) => {
    setProcessingId(agreementId);
    setError(null);

    try {
      await supervisionApi.respond(agreementId, false);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || '拒绝协议失败');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-3xl lg:rounded-3xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Biometric overlay */}
        {showBiometric && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <Fingerprint className="w-10 h-10 text-primary" />
              </div>
              <div className="text-white font-medium mb-2">请进行指纹验证</div>
              <div className="text-sm text-slate-300">验证您的身份以签署协议</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500 dark:text-orange-400" />
            <h2 className="font-bold text-lg">待处理的协议请求</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {requests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              暂无待处理的请求
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                // Determine who the other party is
                const isInitiatorSupervisor = request.initiatorRole === 'SUPERVISOR';
                const otherName = isInitiatorSupervisor ? request.supervisorName : request.superviseeName;
                const otherAvatar = isInitiatorSupervisor ? request.supervisorAvatar : request.superviseeAvatar;
                const willBeSupervisor = !isInitiatorSupervisor;

                return (
                  <div
                    key={request.id}
                    className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                        {otherAvatar ? (
                          <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl text-slate-600 dark:text-slate-300">{otherName.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{otherName}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          希望{isInitiatorSupervisor ? '成为您的监督人' : '让您成为其监督人'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                        <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">您的角色</div>
                        <div className="flex items-center gap-1">
                          {willBeSupervisor ? (
                            <>
                              <Shield className="w-4 h-4 text-primary" />
                              <span className="text-primary font-medium">监督人</span>
                            </>
                          ) : (
                            <>
                              <User className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                              <span className="text-blue-500 dark:text-blue-400 font-medium">被监督人</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                        <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">有效期</div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-800 dark:text-slate-100 font-medium">
                            {request.durationDays ? `${request.durationDays}天` : '永久'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={processingId === request.id}
                        className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 disabled:bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:text-slate-400 dark:text-slate-500 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {processingId === request.id && pendingAccept !== request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            拒绝
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleAccept(request.id)}
                        disabled={processingId === request.id}
                        className="flex-1 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-slate-300 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {processingId === request.id && pendingAccept === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            同意
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisionRequestModal;
