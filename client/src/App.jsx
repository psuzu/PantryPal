import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import './App.css'

const api = async (path, options = {}, userId = 1) => {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': String(userId),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed.' }))
    throw new Error(error.message)
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

const navItems = [
  { key: 'discover', label: 'Discover' },
  { key: 'my-recipes', label: 'My Recipes' },
  { key: 'builder', label: 'Grocery Builder' },
  { key: 'my-lists', label: 'My Grocery Lists' },
]

const initialAuth = { name: '', email: '', password: '', confirmPassword: '' }
const initialProfileForm = { name: '', email: '', password: '', confirmPassword: '' }
const initialSettingsForm = {
  defaultListName: 'Weekly Groceries',
  preferredExportFormat: 'csv',
  showPurchasedInExports: true,
  showNotesInExports: true,
  temperature: 'warm',
}

const normalizeQuantity = (value) => {
  const next = Number(value)
  if (Number.isNaN(next)) {
    return value
  }
  return Number(next.toFixed(2))
}

function App() {
  const [user, setUser] = useState(() => {
    const stored = window.localStorage.getItem('pantrypal-user')
    return stored ? JSON.parse(stored) : null
  })
  const [route, setRoute] = useState(user ? { page: 'discover' } : { page: 'landing' })
  const [meta, setMeta] = useState({ categories: ['All'], cuisines: ['All'] })
  const [discoverFilters, setDiscoverFilters] = useState({
    search: '',
    category: 'All',
    cuisine: 'All',
  })
  const [discoverRecipes, setDiscoverRecipes] = useState([])
  const [discoverLoading, setDiscoverLoading] = useState(Boolean(user))
  const [myRecipeFilters, setMyRecipeFilters] = useState({
    search: '',
    category: 'All',
    cuisine: 'All',
    favorites: false,
  })
  const [savedRecipes, setSavedRecipes] = useState([])
  const [savedLoading, setSavedLoading] = useState(Boolean(user))
  const [recipeDetail, setRecipeDetail] = useState(null)
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [lists, setLists] = useState([])
  const [listsSearch, setListsSearch] = useState('')
  const [listsLoading, setListsLoading] = useState(Boolean(user))
  const [listDetail, setListDetail] = useState(null)
  const [listFilters, setListFilters] = useState({ search: '', uncheckedOnly: false })
  const [listLoading, setListLoading] = useState(false)
  const [builderName, setBuilderName] = useState('')
  const [builderDescription, setBuilderDescription] = useState('Consolidated ingredients for the next few meals')
  const [builderSelections, setBuilderSelections] = useState([])
  const [builderPreview, setBuilderPreview] = useState({
    selectedRecipes: 0,
    uniqueIngredients: 0,
    items: [],
  })
  const [modal, setModal] = useState(null)
  const [message, setMessage] = useState('')
  const [authForm, setAuthForm] = useState(initialAuth)
  const [authError, setAuthError] = useState('')
  const [activeTab, setActiveTab] = useState('ingredients')
  const [listDraftName, setListDraftName] = useState('')
  const [listDraftDescription, setListDraftDescription] = useState('')
  const [profileForm, setProfileForm] = useState(initialProfileForm)
  const [settingsForm, setSettingsForm] = useState(initialSettingsForm)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [landingPreview, setLandingPreview] = useState({ count: 12, recipes: [] })

  const deferredDiscoverSearch = useDeferredValue(discoverFilters.search)
  const deferredSavedSearch = useDeferredValue(myRecipeFilters.search)
  const deferredListSearch = useDeferredValue(listsSearch)
  const deferredIngredientSearch = useDeferredValue(listFilters.search)

  useEffect(() => {
    if (user) {
      window.localStorage.setItem('pantrypal-user', JSON.stringify(user))
    } else {
      window.localStorage.removeItem('pantrypal-user')
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      return
    }

    api('/api/meta', {}, user.id)
      .then(setMeta)
      .catch((error) => setMessage(error.message))
  }, [user])

  useEffect(() => {
    if (user) {
      return
    }

    api('/api/landing-recipes')
      .then(setLandingPreview)
      .catch((error) => setMessage(error.message))
  }, [user])

  useEffect(() => {
    if (!user) {
      return
    }

    api('/api/me', {}, user.id)
      .then((data) => {
        setProfileForm({
          name: data.name,
          email: data.email,
          password: '',
          confirmPassword: '',
        })
      })
      .catch((error) => setMessage(error.message))

    api('/api/me/settings', {}, user.id)
      .then((data) => {
        setSettingsForm(data)
        setBuilderName(data.defaultListName || 'Weekly Groceries')
      })
      .catch((error) => setMessage(error.message))
  }, [user])

  useEffect(() => {
    if (!user) {
      return
    }

    const query = new URLSearchParams({
      search: deferredDiscoverSearch,
      category: discoverFilters.category,
      cuisine: discoverFilters.cuisine,
    })

    api(`/api/discover?${query.toString()}`, {}, user.id)
      .then(setDiscoverRecipes)
      .catch((error) => setMessage(error.message))
      .finally(() => setDiscoverLoading(false))
  }, [user, deferredDiscoverSearch, discoverFilters.category, discoverFilters.cuisine])

  useEffect(() => {
    if (!user) {
      return
    }

    const query = new URLSearchParams({
      search: deferredSavedSearch,
      category: myRecipeFilters.category,
      cuisine: myRecipeFilters.cuisine,
      favorites: String(myRecipeFilters.favorites),
    })

    api(`/api/my-recipes?${query.toString()}`, {}, user.id)
      .then((data) => {
        setSavedRecipes(data)
        setBuilderSelections((current) => {
          const next = data.map((recipe) => {
            const existing = current.find((item) => item.recipeId === recipe.id)
            return existing || { recipeId: recipe.id, name: recipe.name, multiplier: 1, checked: false }
          })
          return next
        })
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setSavedLoading(false))
  }, [
    user,
    deferredSavedSearch,
    myRecipeFilters.category,
    myRecipeFilters.cuisine,
    myRecipeFilters.favorites,
  ])

  useEffect(() => {
    if (!user) {
      return
    }

    const query = new URLSearchParams({
      search: deferredListSearch,
    })

    api(`/api/grocery-lists?${query.toString()}`, {}, user.id)
      .then(setLists)
      .catch((error) => setMessage(error.message))
      .finally(() => setListsLoading(false))
  }, [user, deferredListSearch])

  useEffect(() => {
    const selected = builderSelections.filter((item) => item.checked)
    if (!user || !selected.length) {
      return
    }

    api(
      '/api/grocery-lists/preview',
      {
        method: 'POST',
        body: JSON.stringify({
          selections: selected.map((item) => ({
            recipeId: item.recipeId,
            multiplier: item.multiplier,
          })),
        }),
      },
      user.id,
    )
      .then(setBuilderPreview)
      .catch((error) => setMessage(error.message))
  }, [builderSelections, user])

  useEffect(() => {
    if (!user || route.page !== 'list-detail' || !route.id) {
      return
    }

    const query = new URLSearchParams({
      search: deferredIngredientSearch,
      uncheckedOnly: String(listFilters.uncheckedOnly),
    })

    api(`/api/grocery-lists/${route.id}?${query.toString()}`, {}, user.id)
      .then((data) => {
        setListDetail(data)
        setListDraftName(data.name)
        setListDraftDescription(data.description || '')
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setListLoading(false))
  }, [user, route, deferredIngredientSearch, listFilters.uncheckedOnly])

  useEffect(() => {
    if (!message) {
      return undefined
    }

    const timeout = window.setTimeout(() => setMessage(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [message])

  useEffect(() => {
    document.documentElement.dataset.temperature = settingsForm.temperature || 'warm'
  }, [settingsForm.temperature])

  const displayedPreview = useMemo(() => {
    const selectedCount = builderSelections.filter((item) => item.checked).length
    if (!selectedCount) {
      return { selectedRecipes: 0, uniqueIngredients: 0, items: [] }
    }
    return builderPreview
  }, [builderPreview, builderSelections])

  const authMode = route.page === 'signup' ? 'signup' : 'login'

  const openRecipe = async (recipeId, source = 'discover') => {
    if (!user) {
      return
    }

    setRecipeLoading(true)
    setActiveTab('ingredients')

    try {
      const data = await api(`/api/recipes/${recipeId}`, {}, user.id)
      setRecipeDetail({ ...data, source })
      setRoute({ page: source === 'saved' ? 'saved-detail' : 'recipe-detail', id: recipeId })
    } catch (error) {
      setMessage(error.message)
    } finally {
      setRecipeLoading(false)
    }
  }

  const refreshLists = async () => {
    if (!user) {
      return
    }

    const data = await api(
      `/api/grocery-lists?${new URLSearchParams({ search: deferredListSearch }).toString()}`,
      {},
      user.id,
    )
    setLists(data)
  }

  const refreshCurrentList = async () => {
    if (!user || route.page !== 'list-detail' || !route.id) {
      return
    }

    const data = await api(
      `/api/grocery-lists/${route.id}?${new URLSearchParams({
        search: deferredIngredientSearch,
        uncheckedOnly: String(listFilters.uncheckedOnly),
      }).toString()}`,
      {},
      user.id,
    )
    setListDetail(data)
    setListDraftName(data.name)
    setListDraftDescription(data.description || '')
  }

  const handleSignup = async () => {
    if (authForm.password !== authForm.confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }

    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
        }),
      })
      setUser(data)
      setDiscoverLoading(true)
      setSavedLoading(true)
      setListsLoading(true)
      setRoute({ page: 'discover' })
      setAuthForm(initialAuth)
      setAuthError('')
      setMessage('Account created. Welcome to PantryPal.')
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleLogin = async () => {
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
        }),
      })
      setUser(data)
      setDiscoverLoading(true)
      setSavedLoading(true)
      setListsLoading(true)
      setRoute({ page: 'discover' })
      setAuthForm(initialAuth)
      setAuthError('')
      setMessage('Welcome back.')
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleSaveRecipe = async (recipeId) => {
    if (!user) {
      return
    }

    try {
      await api(`/api/recipes/${recipeId}/save`, { method: 'POST' }, user.id)
      setMessage('Recipe saved to My Recipes.')
      if (recipeDetail?.id === recipeId) {
        setRecipeDetail({ ...recipeDetail, saved: true })
        setRoute({ page: 'saved-detail', id: recipeId })
      }
      const data = await api('/api/my-recipes?search=&category=All&cuisine=All&favorites=false', {}, user.id)
      setSavedRecipes(data)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleRemoveRecipe = async (recipeId) => {
    if (!user) {
      return
    }

    try {
      await api(`/api/recipes/${recipeId}/save`, { method: 'DELETE' }, user.id)
      setMessage('Recipe removed from your collection.')
      const data = await api('/api/my-recipes?search=&category=All&cuisine=All&favorites=false', {}, user.id)
      setSavedRecipes(data)
      if (recipeDetail?.id === recipeId) {
        setRoute({ page: 'my-recipes' })
      }
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleFavoriteToggle = async (recipeId, favorite) => {
    if (!user) {
      return
    }

    try {
      await api(
        `/api/recipes/${recipeId}/favorite`,
        {
          method: 'PATCH',
          body: JSON.stringify({ favorite }),
        },
        user.id,
      )
      setMessage(favorite ? 'Added to favorites.' : 'Removed from favorites.')
      const data = await api(
        `/api/my-recipes?${new URLSearchParams({
          search: deferredSavedSearch,
          category: myRecipeFilters.category,
          cuisine: myRecipeFilters.cuisine,
          favorites: String(myRecipeFilters.favorites),
        }).toString()}`,
        {},
        user.id,
      )
      setSavedRecipes(data)
      if (recipeDetail?.id === recipeId) {
        setRecipeDetail({ ...recipeDetail, favorite })
      }
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleSaveNote = async () => {
    if (!user || !recipeDetail) {
      return
    }

    try {
      await api(
        `/api/recipes/${recipeDetail.id}/note`,
        {
          method: 'PUT',
          body: JSON.stringify({ note: recipeDetail.note }),
        },
        user.id,
      )
      setMessage('Notes saved.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleCreateList = async () => {
    if (!user) {
      return
    }

    try {
      const list = await api(
        '/api/grocery-lists',
        {
          method: 'POST',
          body: JSON.stringify({
            name: builderName || settingsForm.defaultListName,
            description: builderDescription,
            selections: builderSelections
              .filter((item) => item.checked)
              .map((item) => ({
                recipeId: item.recipeId,
                multiplier: item.multiplier,
              })),
          }),
        },
        user.id,
      )
      setMessage('Grocery list created.')
      setListLoading(true)
      setRoute({ page: 'list-detail', id: list.id })
      setListsSearch('')
      await refreshLists()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) {
      return
    }
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      setMessage('Profile passwords do not match.')
      return
    }

    try {
      const updatedUser = await api(
        '/api/me',
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: profileForm.name,
            email: profileForm.email,
            password: profileForm.password || undefined,
          }),
        },
        user.id,
      )
      setUser(updatedUser)
      setProfileForm((current) => ({ ...current, password: '', confirmPassword: '' }))
      setMessage('Profile updated.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleSaveSettings = async () => {
    if (!user) {
      return
    }

    try {
      const updatedSettings = await api(
        '/api/me/settings',
        {
          method: 'PATCH',
          body: JSON.stringify(settingsForm),
        },
        user.id,
      )
      setSettingsForm(updatedSettings)
      setBuilderName(updatedSettings.defaultListName || 'Weekly Groceries')
      setMessage('Settings updated.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleListItemUpdate = async (ingredientId, patch) => {
    if (!user || !route.id) {
      return
    }

    try {
      await api(
        `/api/grocery-lists/${route.id}/items/${ingredientId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patch),
        },
        user.id,
      )
      await refreshCurrentList()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleDeleteList = async (listId) => {
    if (!user) {
      return
    }

    try {
      await api(`/api/grocery-lists/${listId}`, { method: 'DELETE' }, user.id)
      setMessage('Grocery list deleted.')
      setModal(null)
      await refreshLists()
      if (route.page === 'list-detail' && route.id === listId) {
        setRoute({ page: 'my-lists' })
      }
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleExport = async (format, includePurchased, includeNotes) => {
    if (!user || !route.id) {
      return
    }

    try {
      const query = new URLSearchParams({
        format,
        includePurchased: String(includePurchased),
        includeNotes: String(includeNotes),
      })
      const response = await fetch(`/api/grocery-lists/${route.id}/export?${query.toString()}`, {
        headers: { 'x-user-id': String(user.id) },
      })
      if (!response.ok) {
        throw new Error('Could not export the list.')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${listDetail?.name || 'grocery-list'}.${format}`
      link.click()
      window.URL.revokeObjectURL(url)
      setModal(null)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleRenameList = async () => {
    if (!user || !route.id) {
      return
    }

    try {
      await api(
        `/api/grocery-lists/${route.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: listDraftName,
            description: listDraftDescription,
          }),
        },
        user.id,
      )
      setMessage('List details updated.')
      await refreshCurrentList()
      await refreshLists()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const logout = () => {
    setUser(null)
    setRoute({ page: 'landing' })
    setRecipeDetail(null)
    setListDetail(null)
    setDiscoverLoading(false)
    setSavedLoading(false)
    setListsLoading(false)
  }

  const pageTitle = {
    discover: 'Discover recipes worth saving',
    'my-recipes': 'Your saved collection',
    builder: 'Build a grocery list from saved recipes',
    'my-lists': 'Open and manage your grocery lists',
    'recipe-detail': 'Recipe details',
    'saved-detail': 'Saved recipe details',
    'list-detail': 'Grocery list detail',
    profile: 'Your PantryPal profile',
    settings: 'App settings and defaults',
  }[route.page]

  return (
    <div className="app-shell">
      {message ? <div className="toast">{message}</div> : null}
      {!user ? (
        <PublicShell
          route={route}
          setRoute={setRoute}
          authForm={authForm}
          setAuthForm={setAuthForm}
          authError={authError}
          onLogin={handleLogin}
          onSignup={handleSignup}
          authMode={authMode}
          landingPreview={landingPreview}
        />
      ) : (
        <main className="dashboard">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <div className="brand-badge">PP</div>
              <div>
                <p className="eyebrow">Smart planning</p>
                <h1>PantryPal</h1>
              </div>
            </div>

            <nav className="sidebar-nav">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={route.page === item.key ? 'nav-link active' : 'nav-link'}
                  onClick={() => setRoute({ page: item.key })}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <section className="content">
            <header className="page-header">
              <div>
                <p className="eyebrow">PantryPal dashboard</p>
                <h2>{pageTitle}</h2>
              </div>
              <div className="page-header-actions">
                <div className="status-pill">{savedRecipes.length} saved recipes</div>
                <div className="status-pill">{lists.length} grocery lists</div>
                <div className="profile-menu-shell">
                  <div className="profile-trigger-row">
                    <span className="profile-name-label">{user.name}</span>
                    <button
                      type="button"
                      className="profile-avatar-button"
                      onClick={() => setProfileMenuOpen((current) => !current)}
                    >
                      {user.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </button>
                  </div>
                  {profileMenuOpen ? (
                    <div className="profile-dropdown">
                      <button
                        type="button"
                        className="dropdown-link"
                        onClick={() => {
                          setRoute({ page: 'profile' })
                          setProfileMenuOpen(false)
                        }}
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        className="dropdown-link"
                        onClick={() => {
                          setRoute({ page: 'settings' })
                          setProfileMenuOpen(false)
                        }}
                      >
                        Settings
                      </button>
                      <button
                        type="button"
                        className="dropdown-link dropdown-danger"
                        onClick={() => {
                          setProfileMenuOpen(false)
                          logout()
                        }}
                      >
                        Log out
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            {route.page === 'discover' && (
              <DiscoverView
                filters={discoverFilters}
                setFilters={(updater) => {
                  setDiscoverLoading(true)
                  setDiscoverFilters(updater)
                }}
                recipes={discoverRecipes}
                loading={discoverLoading}
                meta={meta}
                onOpenRecipe={openRecipe}
                onSaveRecipe={handleSaveRecipe}
              />
            )}

            {route.page === 'recipe-detail' && (
              <RecipeDetailView
                recipe={recipeDetail}
                loading={recipeLoading}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onSaveRecipe={handleSaveRecipe}
                onBack={() => setRoute({ page: 'discover' })}
              />
            )}

            {route.page === 'my-recipes' && (
              <MyRecipesView
                filters={myRecipeFilters}
                setFilters={(updater) => {
                  setSavedLoading(true)
                  setMyRecipeFilters(updater)
                }}
                recipes={savedRecipes}
                loading={savedLoading}
                meta={meta}
                onOpenRecipe={(recipeId) => openRecipe(recipeId, 'saved')}
                onRemoveRecipe={handleRemoveRecipe}
                onToggleFavorite={handleFavoriteToggle}
              />
            )}

            {route.page === 'saved-detail' && (
              <SavedRecipeDetailView
                recipe={recipeDetail}
                loading={recipeLoading}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onBack={() => setRoute({ page: 'my-recipes' })}
                onRemoveRecipe={handleRemoveRecipe}
                onToggleFavorite={handleFavoriteToggle}
                onSaveNote={handleSaveNote}
                onNoteChange={(note) => setRecipeDetail((current) => ({ ...current, note }))}
                onAddToBuilder={() => {
                  setBuilderSelections((current) =>
                    current.map((item) =>
                      item.recipeId === recipeDetail.id ? { ...item, checked: true } : item,
                    ),
                  )
                  setRoute({ page: 'builder' })
                }}
              />
            )}

            {route.page === 'builder' && (
              <BuilderView
                builderName={builderName}
                setBuilderName={setBuilderName}
                builderDescription={builderDescription}
                setBuilderDescription={setBuilderDescription}
                selections={builderSelections}
                setSelections={setBuilderSelections}
                preview={displayedPreview}
                onCreateList={handleCreateList}
              />
            )}

            {route.page === 'my-lists' && (
              <MyListsView
                lists={lists}
                loading={listsLoading}
                search={listsSearch}
                setSearch={(value) => {
                  setListsLoading(true)
                  setListsSearch(value)
                }}
                onOpenList={(listId) => {
                  setListLoading(true)
                  setRoute({ page: 'list-detail', id: listId })
                }}
                onCreateNew={() => setRoute({ page: 'builder' })}
                onDeleteList={(listId, name) =>
                  setModal({ type: 'delete', listId, title: 'Delete Grocery List', name })
                }
              />
            )}

            {route.page === 'list-detail' && (
              <ListDetailView
                list={listDetail}
                loading={listLoading}
                search={listFilters.search}
                setSearch={(search) => {
                  setListLoading(true)
                  setListFilters((current) => ({ ...current, search }))
                }}
                uncheckedOnly={listFilters.uncheckedOnly}
                setUncheckedOnly={(uncheckedOnly) => {
                  setListLoading(true)
                  setListFilters((current) => ({ ...current, uncheckedOnly }))
                }}
                listDraftName={listDraftName}
                setListDraftName={setListDraftName}
                listDraftDescription={listDraftDescription}
                setListDraftDescription={setListDraftDescription}
                onSaveHeader={handleRenameList}
                onItemUpdate={handleListItemUpdate}
                onDeleteItem={(ingredientId) => handleListItemUpdate(ingredientId, null)}
                onRemoveItem={async (ingredientId) => {
                  try {
                    await api(
                      `/api/grocery-lists/${route.id}/items/${ingredientId}`,
                      { method: 'DELETE' },
                      user.id,
                    )
                    await refreshCurrentList()
                    await refreshLists()
                  } catch (error) {
                    setMessage(error.message)
                  }
                }}
                onExport={() => setModal({ type: 'export' })}
                onDeleteList={() =>
                  setModal({
                    type: 'delete',
                    listId: route.id,
                    title: 'Delete Grocery List',
                    name: listDetail?.name,
                  })
                }
              />
            )}

            {route.page === 'profile' && (
              <ProfileView
                profileForm={profileForm}
                setProfileForm={setProfileForm}
                onSaveProfile={handleSaveProfile}
              />
            )}

            {route.page === 'settings' && (
              <SettingsView
                settingsForm={settingsForm}
                setSettingsForm={setSettingsForm}
                onSaveSettings={handleSaveSettings}
              />
            )}
          </section>
        </main>
      )}

      {modal?.type === 'delete' ? (
        <ConfirmModal
          title={modal.title}
          description={`Are you sure you want to delete "${modal.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          onClose={() => setModal(null)}
          onConfirm={() => handleDeleteList(modal.listId)}
        />
      ) : null}

      {modal?.type === 'export' ? (
        <ExportModal
          settings={settingsForm}
          onClose={() => setModal(null)}
          onExport={handleExport}
        />
      ) : null}
    </div>
  )
}

function PublicShell({
  route,
  setRoute,
  authForm,
  setAuthForm,
  authError,
  onLogin,
  onSignup,
  authMode,
  landingPreview,
}) {
  if (route.page === 'landing') {
    return (
      <main className="landing">
        <section className="hero-panel">
          <p className="eyebrow">Recipe discovery + grocery planning</p>
          <h1>PantryPal keeps saved meals and shopping lists in one place.</h1>
          <p className="hero-copy">
            Search recipes, save favorites, combine duplicate ingredients across meals, and export
            a polished grocery list when you are ready to shop.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => setRoute({ page: 'signup' })}>
              Sign Up
            </button>
            <button type="button" className="secondary-button" onClick={() => setRoute({ page: 'login' })}>
              Log In
            </button>
          </div>
          <div className="feature-row">
            <FeatureChip label="Save recipes" />
            <FeatureChip label="Build grocery lists" />
            <FeatureChip label="Export CSV or JSON" />
          </div>
        </section>

        <section className="landing-preview">
          <div className="preview-card">
            <div className="preview-header">
              <span>Discover</span>
              <span className="preview-accent">{landingPreview.count} recipes</span>
            </div>
            <div className="preview-grid">
              {landingPreview.recipes.slice(0, 4).map((recipe) => (
                <PreviewRecipe
                  key={recipe.id}
                  title={recipe.name}
                  meta={`${recipe.cuisine} ${recipe.category}`}
                  imageUrl={recipe.imageUrl}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <p className="eyebrow">{authMode === 'signup' ? 'Create account' : 'Welcome back'}</p>
        <h2>{authMode === 'signup' ? 'Start building your recipe library.' : 'Log in to your saved recipes.'}</h2>
        {authMode === 'signup' ? (
          <label>
            Name
            <input
              value={authForm.name}
              onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Suzu Paudel"
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            value={authForm.email}
            onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="suzu@pantrypal.app"
          />
          <small>Use the seeded demo account or create your own.</small>
        </label>
        <label>
          Password
          <input
            type="password"
            value={authForm.password}
            onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="demo1234"
          />
          <small>Demo login: `suzu@pantrypal.app` / `demo1234`</small>
        </label>
        {authMode === 'signup' ? (
          <label>
            Confirm password
            <input
              type="password"
              value={authForm.confirmPassword}
              onChange={(event) =>
                setAuthForm((current) => ({ ...current, confirmPassword: event.target.value }))
              }
              placeholder="Confirm password"
            />
          </label>
        ) : null}
        {authError ? <p className="error-text">{authError}</p> : null}
        <button
          type="button"
          className="primary-button wide"
          onClick={authMode === 'signup' ? onSignup : onLogin}
        >
          {authMode === 'signup' ? 'Create Account' : 'Log In'}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => setRoute({ page: authMode === 'signup' ? 'login' : 'signup' })}
        >
          {authMode === 'signup' ? 'Already have an account? Log in.' : 'Need an account? Sign up.'}
        </button>
      </section>
    </main>
  )
}

function DiscoverView({ filters, setFilters, recipes, loading, meta, onOpenRecipe, onSaveRecipe }) {
  return (
    <section className="panel">
      <Toolbar
        searchValue={filters.search}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
        searchPlaceholder="Search recipes"
        category={filters.category}
        cuisine={filters.cuisine}
        categories={meta.categories}
        cuisines={meta.cuisines}
        onCategoryChange={(category) => setFilters((current) => ({ ...current, category }))}
        onCuisineChange={(cuisine) => setFilters((current) => ({ ...current, cuisine }))}
      />

      {loading ? <p className="loading-text">Loading recipes…</p> : null}
      <div className="recipe-grid">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            primaryLabel="View"
            secondaryLabel={recipe.saved ? 'Saved' : 'Save'}
            onPrimary={() => onOpenRecipe(recipe.id)}
            onSecondary={() => !recipe.saved && onSaveRecipe(recipe.id)}
            disableSecondary={recipe.saved}
          />
        ))}
      </div>
    </section>
  )
}

function RecipeDetailView({ recipe, loading, activeTab, onTabChange, onSaveRecipe, onBack }) {
  if (loading || !recipe) {
    return <section className="panel"><p className="loading-text">Loading recipe details…</p></section>
  }

  return (
    <section className="detail-shell">
      <button type="button" className="text-button align-left" onClick={onBack}>
        ← Back to Discover
      </button>
      <div className="detail-grid">
        <img src={recipe.imageUrl} alt={recipe.name} className="detail-image" />
        <div className="detail-card">
          <div className="tag-row">
            <span className="tag">{recipe.cuisine}</span>
            <span className="tag">{recipe.category}</span>
            {recipe.averageRating ? <span className="tag">Rating {recipe.averageRating}</span> : null}
          </div>
          <h3>{recipe.name}</h3>
          <p>{recipe.description}</p>
          <button type="button" className="primary-button" onClick={() => onSaveRecipe(recipe.id)}>
            Save to My Recipes
          </button>
          <TabButtons activeTab={activeTab} onTabChange={onTabChange} />
          {activeTab === 'ingredients' ? (
            <IngredientList ingredients={recipe.ingredients} />
          ) : (
            <InstructionList instructions={recipe.instructions} />
          )}
        </div>
      </div>
    </section>
  )
}

function MyRecipesView({
  filters,
  setFilters,
  recipes,
  loading,
  meta,
  onOpenRecipe,
  onRemoveRecipe,
  onToggleFavorite,
}) {
  return (
    <section className="panel">
      <Toolbar
        searchValue={filters.search}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
        searchPlaceholder="Search my saved recipes"
        category={filters.category}
        cuisine={filters.cuisine}
        categories={meta.categories}
        cuisines={meta.cuisines}
        onCategoryChange={(category) => setFilters((current) => ({ ...current, category }))}
        onCuisineChange={(cuisine) => setFilters((current) => ({ ...current, cuisine }))}
      >
        <button
          type="button"
          className={filters.favorites ? 'filter-pill active' : 'filter-pill'}
          onClick={() => setFilters((current) => ({ ...current, favorites: !current.favorites }))}
        >
          Favorites only
        </button>
      </Toolbar>

      {loading ? <p className="loading-text">Loading saved recipes…</p> : null}
      <div className="recipe-grid">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            saved
            primaryLabel="Open"
            secondaryLabel="Remove"
            onPrimary={() => onOpenRecipe(recipe.id)}
            onSecondary={() => onRemoveRecipe(recipe.id)}
            favorite={recipe.favorite}
            onToggleFavorite={() => onToggleFavorite(recipe.id, !recipe.favorite)}
          />
        ))}
      </div>
    </section>
  )
}

function SavedRecipeDetailView({
  recipe,
  loading,
  activeTab,
  onTabChange,
  onBack,
  onRemoveRecipe,
  onToggleFavorite,
  onSaveNote,
  onNoteChange,
  onAddToBuilder,
}) {
  if (loading || !recipe) {
    return <section className="panel"><p className="loading-text">Loading saved recipe…</p></section>
  }

  return (
    <section className="detail-shell">
      <button type="button" className="text-button align-left" onClick={onBack}>
        ← Back to My Recipes
      </button>
      <div className="saved-detail-layout">
        <div className="detail-main">
          <img src={recipe.imageUrl} alt={recipe.name} className="detail-image" />
          <div className="detail-card">
            <div className="tag-row">
              <span className="tag saved">Saved</span>
              <span className="tag">{recipe.cuisine}</span>
              <span className="tag">{recipe.category}</span>
            </div>
            <h3>{recipe.name}</h3>
            <p>{recipe.description}</p>
            <div className="stacked-actions">
              <button type="button" className="primary-button" onClick={onAddToBuilder}>
                Add to Grocery List
              </button>
              <button type="button" className="secondary-button" onClick={() => onRemoveRecipe(recipe.id)}>
                Remove from My Recipes
              </button>
              <button
                type="button"
                className={recipe.favorite ? 'filter-pill active' : 'filter-pill'}
                onClick={() => onToggleFavorite(recipe.id, !recipe.favorite)}
              >
                {recipe.favorite ? 'Favorite recipe' : 'Mark as favorite'}
              </button>
            </div>
            <TabButtons activeTab={activeTab} onTabChange={onTabChange} />
            {activeTab === 'ingredients' ? (
              <IngredientList ingredients={recipe.ingredients} />
            ) : (
              <InstructionList instructions={recipe.instructions} />
            )}
          </div>
        </div>

        <aside className="notes-panel">
          <p className="eyebrow">My Notes</p>
          <textarea
            value={recipe.note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add substitutions, serving ideas, or prep reminders."
          />
          <button type="button" className="primary-button" onClick={onSaveNote}>
            Save Notes
          </button>
        </aside>
      </div>
    </section>
  )
}

function BuilderView({
  builderName,
  setBuilderName,
  builderDescription,
  setBuilderDescription,
  selections,
  setSelections,
  preview,
  onCreateList,
}) {
  return (
    <section className="builder-layout">
      <div className="builder-card">
        <p className="eyebrow">New grocery list</p>
        <label>
          List name
          <input value={builderName} onChange={(event) => setBuilderName(event.target.value)} />
        </label>
        <label>
          Description
          <input
            value={builderDescription}
            onChange={(event) => setBuilderDescription(event.target.value)}
          />
        </label>
        <div className="selection-list">
          {selections.map((selection) => (
            <div key={selection.recipeId} className="selection-row">
              <label className="selection-check">
                <input
                  type="checkbox"
                  checked={selection.checked}
                  onChange={(event) =>
                    setSelections((current) =>
                      current.map((item) =>
                        item.recipeId === selection.recipeId
                          ? { ...item, checked: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                <span>{selection.name}</span>
              </label>
              <div className="multiplier-control">
                <button
                  type="button"
                  onClick={() =>
                    setSelections((current) =>
                      current.map((item) =>
                        item.recipeId === selection.recipeId
                          ? { ...item, multiplier: Math.max(1, item.multiplier - 1) }
                          : item,
                      ),
                    )
                  }
                >
                  −
                </button>
                <span>{selection.multiplier}x</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelections((current) =>
                      current.map((item) =>
                        item.recipeId === selection.recipeId
                          ? { ...item, multiplier: item.multiplier + 1 }
                          : item,
                      ),
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="builder-preview">
        <div className="preview-summary">
          <div>
            <strong>{preview.selectedRecipes}</strong>
            <span> selected recipes</span>
          </div>
          <div>
            <strong>{preview.uniqueIngredients}</strong>
            <span> unique ingredients</span>
          </div>
        </div>
        <ul className="preview-ingredients">
          {preview.items.map((item) => (
            <li key={`${item.ingredientId}-${item.unit}`}>
              <span>{item.ingredient}</span>
              <strong>
                {item.quantity} {item.unit}
              </strong>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="primary-button"
          onClick={onCreateList}
          disabled={!preview.selectedRecipes}
        >
          Generate Grocery List
        </button>
      </div>
    </section>
  )
}

function MyListsView({ lists, loading, search, setSearch, onOpenList, onCreateNew, onDeleteList }) {
  return (
    <section className="panel">
      <div className="toolbar split">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search lists"
        />
        <button type="button" className="primary-button" onClick={onCreateNew}>
          New List
        </button>
      </div>

      {loading ? <p className="loading-text">Loading grocery lists…</p> : null}
      <div className="list-stack">
        {lists.map((list) => (
          <article key={list.id} className="list-card">
            <div>
              <h3>{list.name}</h3>
              <p>{list.description || 'No description yet.'}</p>
            </div>
            <div className="list-meta">
              <span>{list.itemCount} items</span>
              <span> Updated {new Date(list.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="list-actions">
              <button type="button" className="secondary-button" onClick={() => onOpenList(list.id)}>
                Open
              </button>
              <button type="button" className="danger-button" onClick={() => onDeleteList(list.id, list.name)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ListDetailView({
  list,
  loading,
  search,
  setSearch,
  uncheckedOnly,
  setUncheckedOnly,
  listDraftName,
  setListDraftName,
  listDraftDescription,
  setListDraftDescription,
  onSaveHeader,
  onItemUpdate,
  onRemoveItem,
  onExport,
  onDeleteList,
}) {
  if (loading || !list) {
    return <section className="panel"><p className="loading-text">Loading list…</p></section>
  }

  return (
    <section className="panel">
      <div className="detail-header-grid">
        <div className="list-header-fields">
          <label>
            List name
            <input value={listDraftName} onChange={(event) => setListDraftName(event.target.value)} />
          </label>
          <label>
            Description
            <input
              value={listDraftDescription}
              onChange={(event) => setListDraftDescription(event.target.value)}
            />
          </label>
          <button type="button" className="secondary-button" onClick={onSaveHeader}>
            Save Header
          </button>
        </div>

        <div className="header-actions-card">
          <span>Last updated {new Date(list.updatedAt).toLocaleString()}</span>
          <button type="button" className="primary-button" onClick={onExport}>
            Export
          </button>
          <button type="button" className="danger-button" onClick={onDeleteList}>
            Delete List
          </button>
        </div>
      </div>

      <div className="toolbar split responsive">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ingredients" />
        <button
          type="button"
          className={uncheckedOnly ? 'filter-pill active' : 'filter-pill'}
          onClick={() => setUncheckedOnly(!uncheckedOnly)}
        >
          Unchecked only
        </button>
      </div>

      <div className="list-table">
        <div className="table-head">
          <span>Done</span>
          <span>Ingredient</span>
          <span>Quantity</span>
          <span>Notes</span>
          <span>Remove</span>
        </div>
        {list.items.map((item) => (
          <div key={item.ingredientId} className="table-row">
            <input
              type="checkbox"
              checked={Boolean(item.purchased)}
              onChange={(event) => onItemUpdate(item.ingredientId, { purchased: event.target.checked })}
            />
            <strong>{item.ingredient}</strong>
            <div className="quantity-edit">
              <input
                value={item.quantity}
                onChange={(event) =>
                  onItemUpdate(item.ingredientId, {
                    quantity: normalizeQuantity(event.target.value),
                  })
                }
              />
              <input
                value={item.unit}
                onChange={(event) => onItemUpdate(item.ingredientId, { unit: event.target.value })}
              />
            </div>
            <input
              value={item.note || ''}
              placeholder="Add note"
              onChange={(event) => onItemUpdate(item.ingredientId, { note: event.target.value })}
            />
            <button type="button" className="icon-button" onClick={() => onRemoveItem(item.ingredientId)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProfileView({ profileForm, setProfileForm, onSaveProfile }) {
  return (
    <section className="panel profile-settings-panel">
      <div className="form-grid">
        <label>
          Full name
          <input
            value={profileForm.name}
            onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label>
          Email
          <input
            value={profileForm.email}
            onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={profileForm.password}
            onChange={(event) => setProfileForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Leave blank to keep current password"
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={profileForm.confirmPassword}
            onChange={(event) =>
              setProfileForm((current) => ({ ...current, confirmPassword: event.target.value }))
            }
          />
        </label>
      </div>
      <div className="settings-summary-card">
        <p className="eyebrow">Profile</p>
        <h3>Manage your account details</h3>
        <p>Update your account details and keep your PantryPal profile current.</p>
        <button type="button" className="primary-button" onClick={onSaveProfile}>
          Save Profile
        </button>
      </div>
    </section>
  )
}

function SettingsView({ settingsForm, setSettingsForm, onSaveSettings }) {
  return (
    <section className="panel profile-settings-panel">
      <div className="form-grid">
        <label>
          Default grocery list name
          <input
            value={settingsForm.defaultListName}
            onChange={(event) =>
              setSettingsForm((current) => ({ ...current, defaultListName: event.target.value }))
            }
          />
        </label>
        <label>
          Preferred export format
          <select
            value={settingsForm.preferredExportFormat}
            onChange={(event) =>
              setSettingsForm((current) => ({ ...current, preferredExportFormat: event.target.value }))
            }
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <label>
          Temperature
          <select
            value={settingsForm.temperature}
            onChange={(event) =>
              setSettingsForm((current) => ({ ...current, temperature: event.target.value }))
            }
          >
            <option value="warm">Warm</option>
            <option value="neutral">Neutral</option>
            <option value="cool">Cool</option>
          </select>
        </label>
        <label className="check-row setting-checkbox">
          <input
            type="checkbox"
            checked={settingsForm.showPurchasedInExports}
            onChange={(event) =>
              setSettingsForm((current) => ({ ...current, showPurchasedInExports: event.target.checked }))
            }
          />
          Include purchased status in exports by default
        </label>
        <label className="check-row setting-checkbox">
          <input
            type="checkbox"
            checked={settingsForm.showNotesInExports}
            onChange={(event) =>
              setSettingsForm((current) => ({ ...current, showNotesInExports: event.target.checked }))
            }
          />
          Include notes in exports by default
        </label>
      </div>
      <div className="settings-summary-card">
        <p className="eyebrow">Settings</p>
        <h3>Choose app defaults</h3>
        <p>These settings control your default grocery list naming and export preferences for future actions.</p>
        <button type="button" className="primary-button" onClick={onSaveSettings}>
          Save Settings
        </button>
      </div>
    </section>
  )
}

function Toolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  category,
  cuisine,
  categories,
  cuisines,
  onCategoryChange,
  onCuisineChange,
  children,
}) {
  return (
    <div className="toolbar">
      <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} />
      <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
        {categories.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select value={cuisine} onChange={(event) => onCuisineChange(event.target.value)}>
        {cuisines.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {children}
    </div>
  )
}

function RecipeCard({
  recipe,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  disableSecondary,
  saved,
  favorite,
  onToggleFavorite,
}) {
  return (
    <article className="recipe-card">
      <img src={recipe.imageUrl} alt={recipe.name} />
      <div className="recipe-card-body">
        <div className="card-meta">
          <span>{recipe.cuisine}</span>
          <span>{recipe.category}</span>
        </div>
        <h3>{recipe.name}</h3>
        <p>{recipe.description}</p>
        <div className="recipe-actions">
          <button type="button" className="secondary-button" onClick={onPrimary}>
            {primaryLabel}
          </button>
          <button
            type="button"
            className={saved ? 'danger-button subtle' : 'primary-button'}
            onClick={onSecondary}
            disabled={disableSecondary}
          >
            {secondaryLabel}
          </button>
        </div>
        {saved ? (
          <div className="saved-footer">
            <span className="saved-badge">Saved</span>
            <button type="button" className={favorite ? 'star-button active' : 'star-button'} onClick={onToggleFavorite}>
              ★
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function IngredientList({ ingredients }) {
  return (
    <ul className="ingredient-list">
      {ingredients.map((ingredient) => (
        <li key={ingredient.id || `${ingredient.name}-${ingredient.unit}`}>
          <span>{ingredient.name}</span>
          <strong>
            {ingredient.quantity} {ingredient.unit}
          </strong>
        </li>
      ))}
    </ul>
  )
}

function InstructionList({ instructions }) {
  return (
    <ol className="instruction-list">
      {instructions.map((step) => (
        <li key={step.stepNumber}>{step.instruction}</li>
      ))}
    </ol>
  )
}

function TabButtons({ activeTab, onTabChange }) {
  return (
    <div className="tab-row">
      <button
        type="button"
        className={activeTab === 'ingredients' ? 'tab-button active' : 'tab-button'}
        onClick={() => onTabChange('ingredients')}
      >
        Ingredients
      </button>
      <button
        type="button"
        className={activeTab === 'instructions' ? 'tab-button active' : 'tab-button'}
        onClick={() => onTabChange('instructions')}
      >
        Instructions
      </button>
    </div>
  )
}

function FeatureChip({ label }) {
  return <span className="feature-chip">{label}</span>
}

function PreviewRecipe({ title, meta, imageUrl }) {
  return (
    <div className="mini-card">
      <div className="mini-image" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined} />
      <strong>{title}</strong>
      <span>{meta}</span>
    </div>
  )
}

function ConfirmModal({ title, description, confirmLabel, tone, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <p className="eyebrow">Confirm action</p>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={tone === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ExportModal({ settings, onClose, onExport }) {
  const [format, setFormat] = useState(settings?.preferredExportFormat || 'csv')
  const [includePurchased, setIncludePurchased] = useState(
    settings?.showPurchasedInExports ?? true,
  )
  const [includeNotes, setIncludeNotes] = useState(
    settings?.showNotesInExports ?? true,
  )

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <p className="eyebrow">Export grocery list</p>
        <h3>Choose your format</h3>
        <div className="export-options">
          <label className={format === 'csv' ? 'export-choice active' : 'export-choice'}>
            <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} />
            <div>
              <strong>CSV</strong>
              <span>Best for printing and spreadsheets.</span>
            </div>
          </label>
          <label className={format === 'json' ? 'export-choice active' : 'export-choice'}>
            <input type="radio" checked={format === 'json'} onChange={() => setFormat('json')} />
            <div>
              <strong>JSON</strong>
              <span>Best for structured data and sharing.</span>
            </div>
          </label>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={includePurchased}
            onChange={(event) => setIncludePurchased(event.target.checked)}
          />
          Include purchased status
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(event) => setIncludeNotes(event.target.checked)}
          />
          Include notes
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => onExport(format, includePurchased, includeNotes)}>
            Download
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
