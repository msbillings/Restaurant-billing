import os

# Fix App.jsx
app_jsx_path = 'Frontend/src/App.jsx'
with open(app_jsx_path, 'r') as f:
    app_content = f.read()

# For the first conflict
app_content = app_content.replace("""<<<<<<< HEAD
                {view === 'kothistory' && <KOTHistory />}
                {view === 'analytics' && <Analytics />}
                {view === 'daybook' && <DayBook />}
=======
                {view === 'kothistory' && <KOTHistory onNavigate={handleViewChange} />}
                {view === 'analytics' && <Analytics />}
                {view === 'daybook' && <DayBook />}
                {view === 'inventory' && <InventoryManagement />}
                {view === 'crm' && <CustomerRelationship />}
                {view === 'staff' && <StaffManagement />}
                {view === 'qrcode' && <QRCodeGenerator />}
>>>>>>> 7b3c02af34594c7ab4eab4c7591e0a297e682249""", """                {view === 'kothistory' && <KOTHistory onNavigate={handleViewChange} />}
                {view === 'analytics' && <Analytics />}
                {view === 'daybook' && <DayBook />}
                {view === 'inventory' && <InventoryManagement />}
                {view === 'crm' && <CustomerRelationship />}
                {view === 'staff' && <StaffManagement />}
                {view === 'qrcode' && <QRCodeGenerator />}""")

# For the second conflict
app_content = app_content.replace("""<<<<<<< HEAD
                {view === 'menu' && <MenuManagement user={user} />}
                {view === 'delivery' && <DeliveryOrders />}
                {view === 'pickup' && <PickupOrders />}
=======
                {view === 'menu' && <MenuManagement user={user} onNavigate={handleViewChange} />}
                {view === 'delivery' && <DeliveryOrders onNavigate={handleViewChange} />}
>>>>>>> 7b3c02af34594c7ab4eab4c7591e0a297e682249""", """                {view === 'menu' && <MenuManagement user={user} onNavigate={handleViewChange} />}
                {view === 'delivery' && <DeliveryOrders onNavigate={handleViewChange} />}
                {view === 'pickup' && <PickupOrders /> }""")

with open(app_jsx_path, 'w') as f:
    f.write(app_content)

# Fix BillHistory.jsx
bill_history_path = 'Frontend/src/components/BillHistory.jsx'
with open(bill_history_path, 'r') as f:
    bill_content = f.read()

bill_content = bill_content.replace("""<<<<<<< HEAD
    <div className="h-full flex flex-col bg-background p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-border/50">
        <div className="flex items-center gap-3">
          {onNavigate && (
            <button 
              onClick={() => onNavigate('dashboard')} 
              className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors mr-1"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-main">Transaction History</h1>
=======
    <div className="h-full flex flex-col bg-background p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-border/50">
        <div className="flex items-center gap-3">
          {onNavigate && (
            <button 
              onClick={() => onNavigate('dashboard')} 
              className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors mr-1"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-main">Transaction History</h1>
>>>>>>> 7b3c02af34594c7ab4eab4c7591e0a297e682249""", """    <div className="h-full flex flex-col bg-background p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-border/50">
        <div className="flex items-center gap-3">
          {onNavigate && (
            <button 
              onClick={() => onNavigate('dashboard')} 
              className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors mr-1"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-main">Transaction History</h1>""")

with open(bill_history_path, 'w') as f:
    f.write(bill_content)
