@extends('adminConsole.layout.app')

@section('content')

<h4 class="mb-4"><i class="fa-solid fa-user-gear me-1"></i>Manage Role</h4>

<!-- Modern Tabs -->
<div class="tab-wrapper mb-4">

    <div class="tab-slider {{ request()->get('tab') == 'view' ? 'right' : 'left' }}"></div>

    <a href="?tab=add" 
       class="tab-item {{ request()->get('tab') != 'view' ? 'active' : '' }}">
        <i class="fa fa-plus-circle me-1"></i> Add Role
    </a>

    <a href="?tab=view" 
       class="tab-item {{ request()->get('tab') == 'view' ? 'active' : '' }}">
        <i class="fa fa-list me-1"></i> View Role
    </a>

</div>

<!-- Content -->
<div class="content-card">

     @if(request()->get('tab') == 'view')
        @include('adminConsole.manageRole.viewRole')
    @else
        @include('adminConsole.manageRole.addRole')
    @endif

</div>

@endsection