# 🎨 UI/UX Components - Documentation

## 📋 Overview

Koleksi komponen React yang dirancang untuk meningkatkan user experience aplikasi Vena Pictures tanpa merubah fitur dan struktur yang ada.

---

## 📦 Components

### 1. ProjectCard

**File**: `ProjectCard.tsx`  
**Purpose**: Enhanced project card dengan quick actions dan visual indicators

#### Features:
- ✅ Quick status dropdown
- ✅ Visual progress bar
- ✅ Payment status badges
- ✅ Urgency countdown
- ✅ VIP badge
- ✅ Quick action buttons

#### Props:
```typescript
interface ProjectCardProps {
    project: Project;
    client: Client | undefined;
    projectStatusConfig: ProjectStatusConfig[];
    onStatusChange: (projectId: string, newStatus: string) => void;
    onViewDetails: (project: Project) => void;
    onEdit: (project: Project) => void;
    onSendMessage: (project: Project) => void;
    onViewInvoice: (project: Project) => void;
}
```

#### Usage:
```typescript
<ProjectCard
    project={project}
    client={clients.find(c => c.id === project.clientId)}
    projectStatusConfig={profile.projectStatusConfig}
    onStatusChange={handleStatusChange}
    onViewDetails={handleViewDetails}
    onEdit={handleEdit}
    onSendMessage={handleSendMessage}
    onViewInvoice={handleViewInvoice}
/>
```

#### Visual Features:
- **Progress Bar**: Shows completion percentage based on status
- **Payment Badge**: Green (Lunas) or Orange (Sisa Pembayaran)
- **Urgency Indicator**: Shows days until event (orange if ≤7 days)
- **VIP Badge**: Yellow star badge for VIP clients
- **Status Dropdown**: Click to change status without opening form

---

### 2. ClientCard

**File**: `ClientCard.tsx`  
**Purpose**: Comprehensive client card dengan statistics dan quick actions

#### Features:
- ✅ Client statistics summary
- ✅ Payment status display
- ✅ Next project preview
- ✅ VIP badge (auto-calculated)
- ✅ Quick action buttons
- ✅ Formatted contact info

#### Props:
```typescript
interface ClientCardProps {
    client: Client;
    projects: Project[];
    onViewDetails: (client: Client) => void;
    onSendMessage: (client: Client) => void;
    onViewInvoice: (client: Client) => void;
    onSendReminder: (client: Client) => void;
}
```

#### Usage:
```typescript
<ClientCard
    client={client}
    projects={projects}
    onViewDetails={handleViewDetails}
    onSendMessage={handleSendMessage}
    onViewInvoice={handleViewInvoice}
    onSendReminder={handleSendReminder}
/>
```

#### VIP Criteria:
- Lifetime value > Rp 20.000.000, OR
- Completed projects ≥ 5

---

### 3. CollapsibleSection

**File**: `CollapsibleSection.tsx`  
**Purpose**: Accordion sections untuk form panjang

#### Features:
- ✅ Smooth expand/collapse
- ✅ Status indicator
- ✅ Custom icon support
- ✅ Status text display

#### Props:
```typescript
interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    status?: 'valid' | 'warning' | 'error' | 'info';
    statusText?: string;
    icon?: React.ReactNode;
}
```

#### Usage:
```typescript
<CollapsibleSection
    title="Informasi Dasar"
    defaultExpanded={true}
    status="valid"
    icon={<FolderKanbanIcon className="w-5 h-5" />}
>
    <div className="space-y-5">
        {/* Your form fields */}
    </div>
</CollapsibleSection>
```

#### Status Types:
- **valid**: Green checkmark (✓)
- **warning**: Orange alert (⚠)
- **error**: Red alert (⚠)
- **info**: Blue info (ℹ)

---

### 4. BatchPayment

**File**: `BatchPayment.tsx`  
**Purpose**: Batch payment interface untuk multiple items

#### Features:
- ✅ Checkbox selection
- ✅ Select all/deselect all
- ✅ Real-time total
- ✅ Balance validation
- ✅ Card/Pocket support
- ✅ Loading states

#### Props:
```typescript
interface BatchPaymentProps {
    payments: TeamProjectPayment[];
    cards: Card[];
    pockets: FinancialPocket[];
    onBatchPay: (
        paymentIds: string[], 
        sourceCardId: string, 
        sourcePocketId?: string
    ) => Promise<void>;
    showNotification: (message: string) => void;
}
```

#### Usage:
```typescript
<BatchPayment
    payments={unpaidPayments}
    cards={cards}
    pockets={pockets}
    onBatchPay={handleBatchPay}
    showNotification={showNotification}
/>
```

#### Validation:
- Checks if balance is sufficient
- Shows green checkmark if OK
- Shows red alert if insufficient
- Disables pay button if invalid

---

### 5. ProgressTracker

**File**: `ProgressTracker.tsx`  
**Purpose**: Visual timeline untuk project progress

#### Features:
- ✅ Visual timeline
- ✅ Overall progress %
- ✅ Status icons
- ✅ Sub-statuses display
- ✅ Deadline countdown
- ✅ Animated bars

#### Props:
```typescript
interface ProgressTrackerProps {
    project: Project;
    statusConfig: ProjectStatusConfig[];
}
```

#### Usage:
```typescript
<ProgressTracker
    project={selectedProject}
    statusConfig={profile.projectStatusConfig}
/>
```

#### Visual Elements:
- **Completed**: Green checkmark (✓)
- **Current**: Blue pulsing dot
- **Pending**: Gray circle (○)
- **Progress Bar**: Animated gradient
- **Deadline**: Color-coded (green/orange/red)

---

### 6. QuickStatusModal

**File**: `QuickStatusModal.tsx`  
**Purpose**: Quick status change modal

#### Features:
- ✅ Radio button selection
- ✅ Notification option
- ✅ Current status indicator
- ✅ Color-coded options
- ✅ Loading state

#### Props:
```typescript
interface QuickStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project | null;
    statusConfig: ProjectStatusConfig[];
    onStatusChange: (
        projectId: string, 
        newStatus: string, 
        notifyClient: boolean
    ) => Promise<void>;
    showNotification: (message: string) => void;
}
```

#### Usage:
```typescript
<QuickStatusModal
    isOpen={isModalOpen}
    onClose={() => setIsModalOpen(false)}
    project={selectedProject}
    statusConfig={profile.projectStatusConfig}
    onStatusChange={handleStatusChange}
    showNotification={showNotification}
/>
```

#### Options:
- **Notify Client**: Checkbox to send notification
- **Status Selection**: Radio buttons with colors
- **Current Indicator**: Shows current status

---

## 🎨 Design System

### Colors

#### Status Colors:
```typescript
const statusColors = {
    success: '#10b981',  // Green
    warning: '#eab308',  // Yellow
    danger: '#ef4444',   // Red
    info: '#3b82f6',     // Blue
    accent: '#8b5cf6',   // Purple
};
```

#### Payment Status:
```typescript
const paymentColors = {
    lunas: '#10b981',      // Green
    dp: '#3b82f6',         // Blue
    belum: '#eab308',      // Yellow
};
```

### Typography

```typescript
const typography = {
    h1: 'text-xl font-bold',
    h2: 'text-lg font-semibold',
    h3: 'text-base font-semibold',
    body: 'text-sm',
    caption: 'text-xs',
};
```

### Spacing

```typescript
const spacing = {
    xs: '0.25rem',  // 4px
    sm: '0.5rem',   // 8px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
};
```

### Breakpoints

```typescript
const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
};
```

---

## 🔧 Common Patterns

### Pattern 1: Card with Quick Actions

```typescript
<div className="bg-brand-surface rounded-2xl shadow-lg border border-brand-border">
    <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold text-lg">{title}</h3>
            <span className="badge">{status}</span>
        </div>
        
        {/* Content */}
        <div className="space-y-3">
            {/* ... */}
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2 mt-4">
            <button className="button-secondary">Action 1</button>
            <button className="button-primary">Action 2</button>
        </div>
    </div>
</div>
```

### Pattern 2: Status Dropdown

```typescript
const [isOpen, setIsOpen] = useState(false);

<div className="relative">
    <button onClick={() => setIsOpen(!isOpen)}>
        Status: {currentStatus}
    </button>
    
    {isOpen && (
        <>
            <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
            <div className="absolute dropdown-menu">
                {statuses.map(status => (
                    <button key={status} onClick={() => handleChange(status)}>
                        {status}
                    </button>
                ))}
            </div>
        </>
    )}
</div>
```

### Pattern 3: Progress Bar

```typescript
<div className="w-full h-2 bg-brand-bg rounded-full overflow-hidden">
    <div 
        className="h-full bg-brand-accent transition-all duration-500"
        style={{ width: `${percentage}%` }}
    />
</div>
```

### Pattern 4: Badge

```typescript
<span className={`
    text-xs px-2 py-1 rounded-full font-semibold
    ${status === 'success' ? 'bg-green-500/20 text-green-500' : ''}
    ${status === 'warning' ? 'bg-orange-500/20 text-orange-500' : ''}
    ${status === 'danger' ? 'bg-red-500/20 text-red-500' : ''}
`}>
    {label}
</span>
```

---

## 🎯 Best Practices

### 1. Always Provide Feedback

```typescript
// Good ✅
const handleAction = async () => {
    setIsLoading(true);
    try {
        await doSomething();
        showNotification('Success!');
    } catch (error) {
        showNotification('Error!');
    } finally {
        setIsLoading(false);
    }
};

// Bad ❌
const handleAction = async () => {
    await doSomething();
};
```

### 2. Validate Before Action

```typescript
// Good ✅
const handlePay = () => {
    if (amount <= 0) {
        showNotification('Invalid amount');
        return;
    }
    if (balance < amount) {
        showNotification('Insufficient balance');
        return;
    }
    processPayment();
};

// Bad ❌
const handlePay = () => {
    processPayment();
};
```

### 3. Use Memoization

```typescript
// Good ✅
const filteredData = useMemo(() => {
    return data.filter(/* ... */);
}, [data, filters]);

// Bad ❌
const filteredData = data.filter(/* ... */);
```

### 4. Handle Loading States

```typescript
// Good ✅
{isLoading ? (
    <div className="spinner" />
) : (
    <div>{content}</div>
)}

// Bad ❌
<div>{content}</div>
```

### 5. Responsive Design

```typescript
// Good ✅
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map(item => <Card key={item.id} {...item} />)}
</div>

// Bad ❌
<div className="grid grid-cols-3 gap-4">
    {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

---

## 🧪 Testing

### Unit Testing Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectCard from './ProjectCard';

describe('ProjectCard', () => {
    it('renders project name', () => {
        render(<ProjectCard project={mockProject} {...props} />);
        expect(screen.getByText('Wedding John & Jane')).toBeInTheDocument();
    });
    
    it('calls onEdit when edit button clicked', () => {
        const onEdit = jest.fn();
        render(<ProjectCard project={mockProject} onEdit={onEdit} {...props} />);
        fireEvent.click(screen.getByTitle('Edit Acara'));
        expect(onEdit).toHaveBeenCalledWith(mockProject);
    });
});
```

---

## 📊 Performance

### Optimization Tips:

1. **Memoize Components**
```typescript
export const ProjectCard = React.memo<ProjectCardProps>(({ ... }) => {
    // Component code
});
```

2. **Use useMemo for Calculations**
```typescript
const statistics = useMemo(() => {
    return calculateStatistics(data);
}, [data]);
```

3. **Lazy Load Heavy Components**
```typescript
const ProgressTracker = lazy(() => import('./ProgressTracker'));
```

4. **Debounce Search**
```typescript
const debouncedSearch = useMemo(
    () => debounce((value) => setSearch(value), 300),
    []
);
```

---

## 🐛 Troubleshooting

### Common Issues:

#### Issue 1: Icons Not Showing
**Solution**: Add to constants.tsx
```typescript
export { MapPinIcon, PhoneIcon } from 'lucide-react';
```

#### Issue 2: Type Errors
**Solution**: Import types
```typescript
import type { Project, Client } from '../../types';
```

#### Issue 3: Styles Not Applied
**Solution**: Check Tailwind config
```javascript
content: ["./components/**/*.{js,ts,jsx,tsx}"]
```

#### Issue 4: Component Not Rendering
**Solution**: Check props and data
```typescript
console.log('Props:', props);
console.log('Data:', data);
```

---

## 📚 Resources

### Documentation:
- **INTEGRATION_GUIDE.md** - Integration steps
- **QUICK_START_UIUX.md** - Quick start guide
- **MOCKUP_UIUX_IMPROVEMENTS.md** - Visual examples

### Examples:
- Check component files for JSDoc
- Check INTEGRATION_GUIDE.md for usage examples
- Check MOCKUP_UIUX_IMPROVEMENTS.md for visual examples

---

## 🤝 Contributing

### Adding New Components:

1. Create component file in `components/`
2. Add TypeScript interfaces
3. Add JSDoc documentation
4. Add to this README
5. Update INTEGRATION_GUIDE.md
6. Add examples

### Code Style:

- Use TypeScript
- Use functional components
- Use hooks (useState, useMemo, etc.)
- Add JSDoc comments
- Follow existing patterns

---

## 📝 Changelog

See **CHANGELOG_UIUX.md** for version history.

---

**Last Updated**: 2025-10-23  
**Version**: 2.0.0  
**Status**: Production Ready

---

## 📦 Complete Component List

### Phase 1 (Basic - 6 components):
1. ProjectCard.tsx
2. ClientCard.tsx
3. CollapsibleSection.tsx
4. BatchPayment.tsx
5. ProgressTracker.tsx
6. QuickStatusModal.tsx

### Phase 2 & 3 (Advanced - 5 components):
7. BottomSheet.tsx
8. SwipeableCard.tsx
9. CommunicationHub.tsx
10. PullToRefresh.tsx
11. FloatingActionButton.tsx

**Total: 11 components** ✅
