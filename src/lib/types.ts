export type ModuleKey =
  | "home"
  | "reports"
  | "leads"
  | "contacts"
  | "accounts"
  | "deals"
  | "tradeFinance"
  | "paymentService"
  | "sustainableFinance"
  | "globalMarket"
  | "lifeInsurance"
  | "tasks"
  | "meetings"
  | "calls"
  | "campaigns"
  | "documents";

/** Shared pipeline stage labels used across Loans and product modules. */
export type PipelineStage =
  | "Identification"
  | "Evaluation"
  | "Approval"
  | "Execution"
  | "Completion";

export type ActivityStatus = "Not Started" | "Completed" | "Deferred";

export type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  owner: string;
  tag?: string;
  status: "New" | "Contacted" | "Qualified" | "Converted";
};

export type ClientStatus = "ETB" | "NTB" | "NNTB";

export type AccountStatus = "Active" | "Inactive";

export type PrimaryIdType = "BR Number" | "Type X" | "C Number";

export type ClientIndustry =
  | "Banking & Financial Services"
  | "Manufacturing"
  | "Technology"
  | "Healthcare"
  | "Retail & Consumer"
  | "Real Estate"
  | "Energy & Resources"
  | "Professional Services"
  | "Transportation & Logistics"
  | "Telecommunications";

export type ClientRating = "Hot" | "Warm" | "Cold";

export type ClientSegment = "Corporate" | "Commercial" | "SME" | "Private Banking";

export type ClientRiskRating = "Low" | "Medium" | "High";

export type ClientKycStatus = "Pending" | "In Progress" | "Approved" | "Expired";

export type ClientRegion =
  | "Hong Kong"
  | "Singapore"
  | "Mainland China"
  | "Asia Pacific"
  | "Europe"
  | "Americas";

export type LegalEntityType =
  | "Limited Company"
  | "Partnership"
  | "Sole Proprietor"
  | "Listed Company"
  | "Branch";

/** Franchise / product lines a client holds or is interested in. */
export type ClientProductInterest =
  | "Loans"
  | "Trade Finance"
  | "Payments"
  | "Cash Management"
  | "FX / Global Markets"
  | "Sustainable Finance"
  | "Life Insurance"
  | "Wealth Management";

export type ContactPreferredChannel =
  | "Email"
  | "Phone"
  | "Mobile"
  | "In-Person"
  | "WeChat / Instant Message";

export type Account = {
  id: string;
  companyName: string;
  status: AccountStatus;
  clientStatus: ClientStatus;
  relationshipManager: string;
  /** Company Phone 1 */
  phone: string;
  /** Company Phone 2 */
  phone2: string;
  /** Company Email */
  email: string;
  website: string;
  sicCode: string;
  industry: ClientIndustry | null;
  /** Commercial Real Estate (CRE) Indicator */
  creIndicator: boolean | null;
  countryRegionCampaignCode: string;
  referralDate: string;
  existingClientReferral: boolean | null;
  hacnBuddyingRegionBranch: string;
  rating: ClientRating | null;
  segment: ClientSegment | null;
  riskRating: ClientRiskRating | null;
  kycStatus: ClientKycStatus | null;
  region: ClientRegion | null;
  legalEntityType: LegalEntityType | null;
  country: string;
  city: string;
  address: string;
  annualRevenue: string;
  employeeCount: string;
  creditLimit: string;
  clientSince: string;
  parentGroup: string;
  primaryIdType: PrimaryIdType | null;
  primaryIdNumber: string;
  /** Products the client holds or is interested in (cross-sell). */
  productsOfInterest: ClientProductInterest[];
  /** Preferred ways to engage the client relationship. */
  preferredChannels: ContactPreferredChannel[];
};

export type ContactStatus = "Active" | "Inactive";

export type ContactRole =
  | "Primary Contact"
  | "Decision Maker"
  | "Treasury"
  | "CFO / Finance"
  | "Legal / Compliance"
  | "Operations"
  | "Other";

export type Contact = {
  id: string;
  name: string;
  title: string;
  department: string;
  accountId: string;
  account: string;
  email: string;
  phone: string;
  mobile: string;
  owner: string;
  status: ContactStatus;
  role: ContactRole | null;
  preferredChannel: ContactPreferredChannel | null;
  region: ClientRegion | null;
  decisionMaker: boolean;
  lastContacted: string;
  notes: string;
};

export type LoanBusinessUnit =
  | "Corporate Banking"
  | "Commercial Banking"
  | "SME Banking"
  | "Private Banking"
  | "Trade Finance";

export type LoanFacilityStatus =
  | "Pipeline"
  | "Committed"
  | "Drawn"
  | "Fully Repaid"
  | "Cancelled";

export type LoanApprovalAuthority =
  | "RM Discretion"
  | "Credit Committee"
  | "Regional Credit"
  | "Head Office";

/** Sub-records under a Loan (deals module only). */
export type LoanFacility = {
  id: string;
  loanId: string;
  name: string;
  tranche: string;
  currency: "CNY" | "HKD" | "USD" | "SGD";
  amount: number;
  status: LoanFacilityStatus;
};

export type Deal = {
  id: string;
  name: string;
  facilityNumber: string;
  accountId: string;
  account: string;
  contact: string;
  owner: string;
  businessUnit: LoanBusinessUnit;
  bookingBranch: string;
  productType: "Term Loan" | "Revolving Credit" | "Overdraft" | "Trade Finance" | "Mortgage";
  purpose: "Working Capital" | "Asset Purchase" | "Refinancing" | "Property Finance" | "Trade Finance" | "Other";
  currency: "CNY" | "HKD" | "USD" | "SGD";
  amount: number;
  approvedAmount: number;
  outstandingBalance: number;
  tenorMonths: number;
  repaymentFrequency: "Monthly" | "Quarterly" | "Semi-annual" | "Bullet";
  rateType: "Fixed" | "Floating";
  interestRate: number;
  benchmarkRate: string;
  spreadBps: number;
  arrangementFeeBps: number;
  commitmentFeeBps: number;
  utilizationPct: number;
  collateralType: "Unsecured" | "Property" | "Cash Deposit" | "Receivables" | "Guarantee" | "Other";
  collateralValue: number;
  ltv: number;
  guarantor: string;
  riskGrade: "Low" | "Medium" | "High";
  internalRating: string;
  facilityStatus: LoanFacilityStatus;
  approvalAuthority: LoanApprovalAuthority;
  syndicated: boolean;
  applicationDate: string;
  approvalDate: string;
  drawdownDate: string;
  maturityDate: string;
  closingDate: string;
  nextReviewDate: string;
  stage: PipelineStage;
  probability: number;
  remarks: string;
  /** ISO timestamp of last edit; used for stale-loan notifications. */
  updatedAt: string;
};

export type Task = {
  id: string;
  subject: string;
  dueDate: string;
  status: ActivityStatus;
  priority: "High" | "Normal" | "Low";
  account: string;
};

export type Meeting = {
  id: string;
  title: string;
  from: string;
  to: string;
  relatedTo: string;
  owner: string;
};

export type Call = {
  id: string;
  subject: string;
  type: "Inbound" | "Outbound";
  startTime: string;
  duration: string;
};

export type CampaignType =
  | "Product Launch"
  | "Client Acquisition"
  | "Cross-Sell / Upsell"
  | "Event / Seminar"
  | "Digital / Email"
  | "Partner Referral"
  | "Conference"
  | "Telemarketing"
  | "Other";

export type CampaignStatus = "Planning" | "Active" | "Inactive" | "Completed" | "Aborted";

export type CampaignChannel =
  | "Email"
  | "Webinar"
  | "In-Person Event"
  | "Phone"
  | "Partner"
  | "Social / Digital Ads"
  | "Direct Mail"
  | "Mixed";

export type Campaign = {
  id: string;
  name: string;
  code: string;
  owner: string;
  type: CampaignType;
  status: CampaignStatus;
  channel: CampaignChannel;
  businessUnit: LoanBusinessUnit;
  targetSegment: ClientSegment | null;
  targetRegion: ClientRegion | null;
  targetProduct: Deal["productType"] | null;
  currency: Deal["currency"];
  startDate: string;
  endDate: string;
  expectedRevenue: number;
  budgetedCost: number;
  actualCost: number;
  expectedResponsePct: number;
  numSent: number;
  leadsGenerated: number;
  convertedCount: number;
  description: string;
};

export type TimelineEvent = {
  id: string;
  time: string;
  title: string;
  detail: string;
};

export type WorkflowRule = {
  name: string;
  module: string;
  condition: string;
  action: string;
};

export type UserStatus = "Active" | "Inactive";

export type UserRole =
  | "RM"
  | "TH"
  | "Dept Head"
  | "DH"
  | "STM"
  | "Developer"
  | "Admin";

export type UserProfile =
  | "Standard"
  | "Administrator"
  | "Read Only"
  | "Business Admin";

export type DemoUser = {
  id: string;
  username: string;
  password: string;
  displayName: string;
  bu: string;
  role: UserRole;
  profile: UserProfile;
  status: UserStatus;
  outlookEmail: string;
  mobile: string;
  manager: string;
  department: string;
  lastLogin: string;
};
